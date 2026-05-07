//! Wideband FM receiver app.
//! Pipeline: HackRF @ 2.4 Msps → FFT spectrum branch
//!                              → decimate to 240 kHz → wideband FM demod (±75 kHz)
//!                              → resample to 48 kHz → audio IPC

use anyhow::Result;
use std::sync::{Arc, Mutex};
use mayhem_dsp::{decimation::FirDecimator, demod_fm::QuadDemod, resample::AudioResampler};
use mayhem_ipc::{AppId, AppMetadata, AudioFrame, Direction, RegulatoryClass, SpectrumFrame, WfmTuning};
use mayhem_radio::{build_source, HackRfSourceConfig};
use num_complex::Complex32;
use tokio::sync::{mpsc, oneshot};
use tracing::{info, warn};

use crate::{App, RunningApp};

const HACKRF_RATE: f64 = 2_400_000.0;
const DECIM: usize = 10; // 2.4 Msps → 240 ksps
const NUM_TAPS: usize = 65;
const AUDIO_OUT_RATE: usize = 48_000;
const WFM_DEVIATION_HZ: f32 = 75_000.0;
const FFT_SIZE: usize = 1024;
const SPECTRUM_PERIOD_MS: u64 = 33;

pub struct WfmRxApp {
    pub audio_tx: mpsc::UnboundedSender<AudioFrame>,
    pub spectrum_tx: mpsc::UnboundedSender<SpectrumFrame>,
}

impl WfmRxApp {
    pub fn new() -> (Self, mpsc::UnboundedReceiver<AudioFrame>, mpsc::UnboundedReceiver<SpectrumFrame>) {
        let (audio_tx, audio_rx) = mpsc::unbounded_channel();
        let (spectrum_tx, spectrum_rx) = mpsc::unbounded_channel();
        (Self { audio_tx, spectrum_tx }, audio_rx, spectrum_rx)
    }
}

impl App for WfmRxApp {
    fn metadata() -> AppMetadata where Self: Sized {
        AppMetadata {
            id: AppId::WfmRx,
            name: "WFM Receiver".to_string(),
            direction: Direction::Rx,
            regulatory_class: RegulatoryClass::Passive,
        }
    }

    fn start(&self, params: serde_json::Value) -> Result<RunningApp> {
        let tuning: WfmTuning = serde_json::from_value(params)?;
        let cfg = HackRfSourceConfig {
            center_hz: tuning.center_hz,
            sample_rate: HACKRF_RATE,
            lna_gain_db: tuning.lna_gain_db,
            vga_gain_db: tuning.vga_gain_db,
            amp_enabled: tuning.amp_enabled,
        };
        cfg.validate()?;

        let audio_tx = self.audio_tx.clone();
        let spectrum_tx = self.spectrum_tx.clone();
        let (stop_tx, stop_rx) = oneshot::channel::<()>();

        let join = tokio::spawn(async move {
            if let Err(e) = run_wfm(cfg, tuning, audio_tx, spectrum_tx, stop_rx).await {
                warn!("wfm flowgraph terminated with error: {e}");
            } else {
                info!("wfm flowgraph stopped cleanly");
            }
        });

        Ok(RunningApp { stop: stop_tx, join })
    }
}

async fn run_wfm(
    cfg: HackRfSourceConfig,
    _tuning: WfmTuning,
    audio_tx: mpsc::UnboundedSender<AudioFrame>,
    spectrum_tx: mpsc::UnboundedSender<SpectrumFrame>,
    stop_rx: oneshot::Receiver<()>,
) -> Result<()> {
    use futuresdr::macros::connect;
    use futuresdr::runtime::Flowgraph;

    // Audio DSP runs in a separate tokio task that consumes batches of IQ over
    // a channel. The flowgraph's audio_sink block is a cheap pass-through that
    // batches samples and ships them out — running the FIR/demod/resampler
    // per-sample inside an Apply closure was too slow at 2.4 Msps and caused
    // continuous Seify Source Overflow warnings.
    const IQ_BATCH: usize = 8192;
    let (iq_tx, mut iq_rx) = mpsc::channel::<Vec<Complex32>>(8);

    let audio_tx_inner = audio_tx;
    tokio::spawn(async move {
        let mut dec = FirDecimator::new(150_000.0, HACKRF_RATE as f32, DECIM, NUM_TAPS);
        let mut demod = QuadDemod::new(WFM_DEVIATION_HZ, (HACKRF_RATE / DECIM as f64) as f32);
        let mut resamp = match AudioResampler::new((HACKRF_RATE as usize) / DECIM, AUDIO_OUT_RATE, 1024) {
            Ok(r) => r,
            Err(e) => { warn!("WFM resampler init failed: {e}"); return; }
        };
        let mut decimated: Vec<Complex32> = Vec::with_capacity(IQ_BATCH / DECIM + 1);
        let mut demod_out: Vec<f32> = Vec::with_capacity(IQ_BATCH / DECIM + 1);
        let mut pcm_scratch: Vec<i16> = Vec::with_capacity(2048);
        let mut audio_seq: u32 = 0;
        let mut last_log = std::time::Instant::now();
        let mut frames_since_log: u64 = 0;
        let mut samples_since_log: u64 = 0;

        while let Some(batch) = iq_rx.recv().await {
            samples_since_log += batch.len() as u64;
            decimated.clear();
            dec.process(&batch, &mut decimated);
            demod_out.clear();
            demod.process(&decimated, &mut demod_out);
            pcm_scratch.clear();
            let _ = resamp.process(&demod_out, &mut pcm_scratch);
            if !pcm_scratch.is_empty() {
                let _ = audio_tx_inner.send(AudioFrame {
                    seq: audio_seq,
                    samples: pcm_scratch.clone(),
                });
                audio_seq = audio_seq.wrapping_add(1);
                frames_since_log += 1;
            }
            if last_log.elapsed() >= std::time::Duration::from_secs(2) {
                info!(
                    "WFM audio: in={} samples/s, out={} frames/s",
                    samples_since_log / 2, frames_since_log / 2
                );
                last_log = std::time::Instant::now();
                frames_since_log = 0;
                samples_since_log = 0;
            }
        }
    });

    let mut iq_batch: Vec<Complex32> = Vec::with_capacity(IQ_BATCH);
    let iq_tx_apply = iq_tx;
    let audio_sink = futuresdr::blocks::Apply::new(move |x: &Complex32| -> Complex32 {
        iq_batch.push(*x);
        if iq_batch.len() >= IQ_BATCH {
            let chunk = std::mem::replace(&mut iq_batch, Vec::with_capacity(IQ_BATCH));
            // try_send: if the audio task is briefly behind, drop the batch
            // rather than back-pressuring the source (which would cause Seify
            // overflow). Spectrum is unaffected since the data still flows
            // downstream via the *x return.
            let _ = iq_tx_apply.try_send(chunk);
        }
        *x
    });

    // Spectrum block with Hann window
    let spectrum_tx_inner = spectrum_tx;
    let center = cfg.center_hz;
    let span = HACKRF_RATE;
    let mut fft_buf: Vec<Complex32> = Vec::with_capacity(FFT_SIZE);
    let mut spec_seq: u32 = 0;
    let mut last_emit = std::time::Instant::now();
    let mut planner = rustfft::FftPlanner::<f32>::new();
    let fft = planner.plan_fft_forward(FFT_SIZE);
    let window = mayhem_dsp::spectrum::hann_window(FFT_SIZE);

    let spec_sink = futuresdr::blocks::Apply::new(move |x: &Complex32| -> Complex32 {
        fft_buf.push(*x);
        if fft_buf.len() >= FFT_SIZE
            && last_emit.elapsed() >= std::time::Duration::from_millis(SPECTRUM_PERIOD_MS)
        {
            let mut windowed: Vec<Complex32> = fft_buf.drain(..FFT_SIZE).collect();
            mayhem_dsp::spectrum::apply_window(&mut windowed, &window);

            let mut buf: Vec<rustfft::num_complex::Complex<f32>> = windowed
                .iter()
                .map(|c| rustfft::num_complex::Complex::new(c.re, c.im))
                .collect();
            fft.process(&mut buf);

            let as_complex32: Vec<Complex32> =
                buf.iter().map(|c| Complex32::new(c.re, c.im)).collect();
            let mut bins = vec![0u8; FFT_SIZE];
            mayhem_dsp::spectrum::log_magnitude_u8(&as_complex32, &mut bins);
            mayhem_dsp::spectrum::fft_shift_u8(&mut bins);

            let _ = spectrum_tx_inner.send(SpectrumFrame {
                seq: spec_seq,
                bins,
                center_hz: center,
                span_hz: span,
            });
            spec_seq = spec_seq.wrapping_add(1);
            last_emit = std::time::Instant::now();
        }
        *x
    });

    let null = futuresdr::blocks::NullSink::<Complex32>::new();

    let fg_handle_shared: Arc<Mutex<Option<futuresdr::runtime::FlowgraphHandle>>> =
        Arc::new(Mutex::new(None));
    let fg_handle_for_stop = Arc::clone(&fg_handle_shared);

    let cfg_thread = cfg;

    let rt_join = tokio::task::spawn_blocking(move || -> Result<()> {
        let mut fg = Flowgraph::new();

        info!("building WFM HackRF source: center={} Hz", cfg_thread.center_hz);
        let src = build_source(&cfg_thread)?;
        info!("WFM HackRF source built");

        connect!(fg, src > audio_sink > spec_sink > null);
        info!("WFM flowgraph connected, starting runtime...");

        let rt = futuresdr::runtime::Runtime::new();
        let (task, handle) = rt.start_sync(fg);
        info!("WFM runtime started");

        *fg_handle_shared.lock().unwrap() = Some(handle);

        let result = async_io::block_on(task);
        match &result {
            Ok(_) => info!("WFM flowgraph task completed ok"),
            Err(e) => warn!("WFM flowgraph task error: {e:?}"),
        }
        result.map_err(|e| anyhow::anyhow!("flowgraph error: {e}"))?;
        Ok(())
    });

    tokio::select! {
        _ = stop_rx => {
            info!("wfm received stop signal; terminating flowgraph");
            tokio::task::spawn_blocking(move || {
                let mut guard = fg_handle_for_stop.lock().unwrap();
                if let Some(mut h) = guard.take() {
                    async_io::block_on(h.terminate());
                }
            }).await?;
        }
        result = rt_join => {
            match result {
                Ok(Ok(())) => {}
                Ok(Err(e)) => warn!("wfm flowgraph error: {e}"),
                Err(e) => warn!("wfm task join error: {e}"),
            }
        }
    }

    info!("wfm flowgraph stopped cleanly");
    Ok(())
}
