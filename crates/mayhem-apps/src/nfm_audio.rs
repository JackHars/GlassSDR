//! NFM audio receiver. Pipeline:
//!   HackRF source @ 2.4 Msps → decimate to 240 kHz → quad-FM demod → resample to 48 kHz
//!                                              ↘ FFT → log-magnitude spectrum frames
//!
//! Outputs are two unbounded mpsc channels (audio_tx, spectrum_tx) that the Tauri runner
//! drains and rebroadcasts via Tauri events.

use anyhow::Result;
use mayhem_dsp::{decimation::FirDecimator, demod_fm::QuadDemod, resample::AudioResampler};
use mayhem_ipc::{AppId, AppMetadata, AudioFrame, Direction, NfmTuning, RegulatoryClass, SpectrumFrame};
use mayhem_radio::{build_source, HackRfSourceConfig};
use serde_json::Value;
use std::sync::{Arc, Mutex};
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

        tokio::spawn(async move {
            if let Err(e) = run_nfm(cfg, tuning, audio_tx, spectrum_tx, stop_rx).await {
                warn!("nfm flowgraph terminated with error: {e}");
            } else {
                info!("nfm flowgraph stopped cleanly");
            }
        });

        Ok(RunningApp { stop: stop_tx })
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

    // Validate config (build_source performs validation; discard the result since the
    // actual source is constructed inside the flowgraph thread below).
    build_source(&cfg).map(drop)?;

    // DSP stages — wrapped in Arc<Mutex<_>> so they can be moved into Apply closures.
    let dec = Arc::new(Mutex::new(FirDecimator::new(
        100_000.0,
        HACKRF_RATE as f32,
        DECIM,
        NUM_TAPS,
    )));
    let demod = Arc::new(Mutex::new(QuadDemod::new(
        FM_MAX_DEVIATION_HZ,
        (HACKRF_RATE / DECIM as f64) as f32,
    )));
    let resamp = Arc::new(Mutex::new(AudioResampler::new(
        (HACKRF_RATE as usize) / DECIM,
        AUDIO_OUT_RATE,
        1024,
    )?));

    // Clone for capture into audio Apply closure.
    let dec_for_audio = Arc::clone(&dec);
    let demod_for_audio = Arc::clone(&demod);
    let resamp_for_audio = Arc::clone(&resamp);
    let audio_tx_inner = audio_tx;
    let mut audio_seq: u32 = 0;

    // Audio Apply block: runs the full DSP chain per-sample and emits AudioFrames.
    // Returns the input sample unchanged so the stream continues to the spectrum sink.
    let audio_sink = futuresdr::blocks::Apply::new(move |x: &Complex32| -> Complex32 {
        let buf = [*x];
        let mut decimated = Vec::new();
        dec_for_audio.lock().unwrap().process(&buf, &mut decimated);

        let mut demod_out = Vec::new();
        demod_for_audio
            .lock()
            .unwrap()
            .process(&decimated, &mut demod_out);

        let mut pcm = Vec::new();
        let _ = resamp_for_audio
            .lock()
            .unwrap()
            .process(&demod_out, &mut pcm);

        if !pcm.is_empty() {
            let _ = audio_tx_inner.send(AudioFrame {
                seq: audio_seq,
                samples: pcm,
            });
            audio_seq = audio_seq.wrapping_add(1);
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

    let spec_sink = futuresdr::blocks::Apply::new(move |x: &Complex32| -> Complex32 {
        fft_buf.push(*x);
        if fft_buf.len() >= FFT_SIZE
            && last_emit.elapsed()
                >= std::time::Duration::from_millis(SPECTRUM_PERIOD_MS)
        {
            let mut buf: Vec<rustfft::num_complex::Complex<f32>> = fft_buf
                .drain(..FFT_SIZE)
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

        let src = futuresdr::blocks::seify::SourceBuilder::new()
            .args("driver=hackrf")?
            .frequency(cfg_thread.center_hz)
            .sample_rate(cfg_thread.sample_rate)
            .gain(cfg_thread.lna_gain_db as f64 + cfg_thread.vga_gain_db as f64)
            .build()?;

        connect!(fg, src > audio_sink > spec_sink > null);

        let rt = futuresdr::runtime::Runtime::new();
        let (task, handle) = rt.start_sync(fg);

        // Publish the FlowgraphHandle so the stop path can call terminate().
        *fg_handle_shared.lock().unwrap() = Some(handle);

        // Block until the flowgraph finishes (either naturally or after terminate()).
        async_io::block_on(task).map_err(|e| anyhow::anyhow!("flowgraph error: {e}"))?;

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
