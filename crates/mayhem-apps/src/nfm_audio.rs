//! NFM audio receiver. Pipeline:
//!   HackRF source @ 2.4 Msps → decimate to 240 kHz → quad-FM demod → resample to 48 kHz
//!                                              ↘ FFT → log-magnitude spectrum frames
//!
//! Outputs are two unbounded mpsc channels (audio_tx, spectrum_tx) that the Tauri runner
//! drains and rebroadcasts via Tauri events.

use anyhow::Result;
use mayhem_dsp::{decimation::FirDecimator, demod_fm::QuadDemod, resample::AudioResampler};
use std::sync::{Arc, Mutex};
use mayhem_ipc::{AppId, AppMetadata, AudioFrame, Direction, NfmTuning, RegulatoryClass, SpectrumFrame};
use mayhem_radio::{build_source, HackRfSourceConfig};
use serde_json::Value;
use tokio::sync::{mpsc, oneshot};
use tracing::{info, warn};

use crate::{App, RunningApp};

const HACKRF_RATE: f64 = 2_400_000.0;
const DECIM: usize = 10; // 2.4 Msps → 240 ksps
const NUM_TAPS: usize = 65;
const AUDIO_OUT_RATE: usize = 48_000;
const FM_MAX_DEVIATION_HZ: f32 = 5_000.0;
const FFT_SIZE: usize = 1024;
const SPECTRUM_PERIOD_MS: u64 = 33; // ~30 fps

pub struct NfmAudioApp {
    pub audio_tx: mpsc::UnboundedSender<AudioFrame>,
    pub spectrum_tx: mpsc::UnboundedSender<SpectrumFrame>,
}

impl NfmAudioApp {
    pub fn new() -> (
        Self,
        mpsc::UnboundedReceiver<AudioFrame>,
        mpsc::UnboundedReceiver<SpectrumFrame>,
    ) {
        let (a_tx, a_rx) = mpsc::unbounded_channel();
        let (s_tx, s_rx) = mpsc::unbounded_channel();
        (
            Self {
                audio_tx: a_tx,
                spectrum_tx: s_tx,
            },
            a_rx,
            s_rx,
        )
    }
}

impl App for NfmAudioApp {
    fn metadata() -> AppMetadata
    where
        Self: Sized,
    {
        AppMetadata {
            id: AppId::NfmAudio,
            name: "NFM Audio".to_string(),
            direction: Direction::Rx,
            regulatory_class: RegulatoryClass::Passive,
        }
    }

    fn start(&self, params: Value) -> Result<RunningApp> {
        let tuning: NfmTuning = serde_json::from_value(params)?;
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
            if let Err(e) = run_nfm(cfg, tuning, audio_tx, spectrum_tx, stop_rx).await {
                warn!("nfm flowgraph terminated with error: {e}");
            } else {
                info!("nfm flowgraph stopped cleanly");
            }
        });

        Ok(RunningApp { stop: stop_tx, join })
    }
}

async fn run_nfm(
    cfg: HackRfSourceConfig,
    tuning: NfmTuning,
    audio_tx: mpsc::UnboundedSender<AudioFrame>,
    spectrum_tx: mpsc::UnboundedSender<SpectrumFrame>,
    stop_rx: oneshot::Receiver<()>,
) -> Result<()> {
    use futuresdr::macros::connect;
    use futuresdr::runtime::Flowgraph;
    use num_complex::Complex32;

    // Audio DSP runs in a separate tokio task that consumes batches of IQ over
    // a channel. The flowgraph's audio_sink block is a cheap pass-through that
    // batches samples and ships them out — running the FIR/demod/resampler
    // per-sample inside an Apply closure was too slow at 2.4 Msps and caused
    // continuous Seify Source Overflow warnings.
    const IQ_BATCH: usize = 8192;
    let (iq_tx, mut iq_rx) = mpsc::channel::<Vec<Complex32>>(8);

    let audio_tx_inner = audio_tx;
    let squelch_threshold_db = tuning.squelch_db;
    tokio::spawn(async move {
        let mut dec = FirDecimator::new(100_000.0, HACKRF_RATE as f32, DECIM, NUM_TAPS);
        let mut demod = QuadDemod::new(FM_MAX_DEVIATION_HZ, (HACKRF_RATE / DECIM as f64) as f32);
        let mut resamp = match AudioResampler::new((HACKRF_RATE as usize) / DECIM, AUDIO_OUT_RATE, 1024) {
            Ok(r) => r,
            Err(e) => { warn!("NFM resampler init failed: {e}"); return; }
        };
        let mut decimated: Vec<Complex32> = Vec::with_capacity(IQ_BATCH / DECIM + 1);
        let mut demod_out: Vec<f32> = Vec::with_capacity(IQ_BATCH / DECIM + 1);
        let mut pcm_scratch: Vec<i16> = Vec::with_capacity(2048);
        let mut audio_seq: u32 = 0;

        while let Some(batch) = iq_rx.recv().await {
            decimated.clear();
            dec.process(&batch, &mut decimated);
            demod_out.clear();
            demod.process(&decimated, &mut demod_out);

            // Squelch: gate audio when post-demod RMS falls below threshold.
            // Convention: squelch_db = -80 → always open; 0 → only loud signals pass.
            if !demod_out.is_empty() {
                let rms_sq: f32 = demod_out.iter().map(|s| s * s).sum::<f32>()
                    / demod_out.len() as f32;
                if rms_sq > 0.0 {
                    let level_db = 10.0 * rms_sq.log10();
                    if level_db < squelch_threshold_db {
                        demod_out.iter_mut().for_each(|s| *s = 0.0);
                    }
                }
            }

            pcm_scratch.clear();
            let _ = resamp.process(&demod_out, &mut pcm_scratch);
            if !pcm_scratch.is_empty() {
                let _ = audio_tx_inner.send(AudioFrame {
                    seq: audio_seq,
                    samples: pcm_scratch.clone(),
                });
                audio_seq = audio_seq.wrapping_add(1);
            }
        }
    });

    let mut iq_batch: Vec<Complex32> = Vec::with_capacity(IQ_BATCH);
    let iq_tx_apply = iq_tx;
    let audio_sink = futuresdr::blocks::Apply::new(move |x: &Complex32| -> Complex32 {
        iq_batch.push(*x);
        if iq_batch.len() >= IQ_BATCH {
            let chunk = std::mem::replace(&mut iq_batch, Vec::with_capacity(IQ_BATCH));
            let _ = iq_tx_apply.try_send(chunk);
        }
        *x
    });

    // Spectrum Apply block: accumulates FFT_SIZE samples, transforms, and emits SpectrumFrames.
    // Rate-limited to ≤30 fps via SPECTRUM_PERIOD_MS.
    let spectrum_tx_inner = spectrum_tx;
    let center = tuning.center_hz;
    let span = HACKRF_RATE;
    let mut fft_buf: Vec<Complex32> = Vec::with_capacity(FFT_SIZE);
    let mut spec_seq: u32 = 0;
    let mut last_emit = std::time::Instant::now();
    // Hoist FFT planner out of the closure: planner and plan are created once.
    let mut planner = rustfft::FftPlanner::<f32>::new();
    let fft = planner.plan_fft_forward(FFT_SIZE);
    let window = mayhem_dsp::spectrum::hann_window(FFT_SIZE);

    let spec_sink = futuresdr::blocks::Apply::new(move |x: &Complex32| -> Complex32 {
        fft_buf.push(*x);
        if fft_buf.len() >= FFT_SIZE
            && last_emit.elapsed()
                >= std::time::Duration::from_millis(SPECTRUM_PERIOD_MS)
        {
            // Take FFT_SIZE samples and apply Hann window before FFT
            let mut windowed: Vec<Complex32> = fft_buf
                .drain(..FFT_SIZE)
                .collect();
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

    // The FlowgraphHandle is shared between the smol runtime thread and the tokio stop
    // handler so that we can call terminate() from tokio's spawn_blocking.
    let fg_handle_shared: Arc<Mutex<Option<futuresdr::runtime::FlowgraphHandle>>> =
        Arc::new(Mutex::new(None));
    let fg_handle_for_stop = Arc::clone(&fg_handle_shared);

    // Capture cfg for the thread (cfg is Clone).
    let cfg_thread = cfg;

    // Run the FutureSDR flowgraph in a tokio blocking thread so we can race its
    // completion against an external stop signal. We use spawn_blocking (not
    // std::thread::spawn) so the JoinHandle is awaitable from within tokio::select!.
    let rt_join = tokio::task::spawn_blocking(move || -> Result<()> {
        let mut fg = Flowgraph::new();

        // amp_enabled is now passed via the args string in build_source() as `amp={0,1}`.
        info!("building HackRF source: center={} Hz, rate={} Sps, lna={} dB, vga={} dB, amp={}",
            cfg_thread.center_hz, cfg_thread.sample_rate,
            cfg_thread.lna_gain_db, cfg_thread.vga_gain_db, cfg_thread.amp_enabled);
        let src = match build_source(&cfg_thread) {
            Ok(s) => {
                info!("HackRF source block created successfully");
                s
            }
            Err(e) => {
                warn!("build_source failed: {e:?}");
                return Err(e);
            }
        };

        connect!(fg, src > audio_sink > spec_sink > null);
        info!("flowgraph connected, starting runtime...");

        let rt = futuresdr::runtime::Runtime::new();
        let (task, handle) = rt.start_sync(fg);
        info!("runtime started, flowgraph running");

        // Publish the FlowgraphHandle so the stop path can call terminate().
        *fg_handle_shared.lock().unwrap() = Some(handle);

        // Block until the flowgraph finishes (either naturally or after terminate()).
        let result = async_io::block_on(task);
        match &result {
            Ok(_) => info!("flowgraph task completed ok"),
            Err(e) => warn!("flowgraph task error: {e:?}"),
        }
        result.map_err(|e| anyhow::anyhow!("flowgraph error: {e}"))?;

        Ok(())
    });

    // Wait for either the stop signal or the flowgraph to finish naturally (e.g.
    // HackRF disconnect). This prevents run_nfm from hanging forever if no stop
    // signal ever arrives.
    tokio::select! {
        _ = stop_rx => {
            info!("nfm received stop signal; terminating flowgraph");
            // Relay the stop into the smol runtime by calling terminate() from a
            // blocking task (block_on is not allowed on the tokio thread).
            tokio::task::spawn_blocking(move || {
                let mut guard = fg_handle_for_stop.lock().unwrap();
                if let Some(ref mut handle) = *guard {
                    // terminate() sends the Terminate message; terminate_and_wait()
                    // polls until the inbox is closed.
                    async_io::block_on(handle.terminate_and_wait())
                        .unwrap_or_else(|e| warn!("terminate_and_wait error: {e}"));
                }
                // v0.1 note: the rt_join task may outlive this task briefly while
                // the smol scheduler drains. The thread is detached on drop.
            })
            .await
            .unwrap_or_else(|e| warn!("spawn_blocking join error: {e}"));
        }
        res = rt_join => {
            match res {
                Ok(Ok(())) => info!("nfm flowgraph terminated naturally"),
                Ok(Err(e)) => warn!("nfm flowgraph error: {e}"),
                Err(e) => warn!("nfm runtime task join error: {e}"),
            }
        }
    }

    Ok(())
}
