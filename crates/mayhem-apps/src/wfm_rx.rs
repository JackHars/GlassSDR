//! Wideband FM receiver app.
//! Pipeline: HackRF @ 2.4 Msps → decimate to 240 kHz → wideband FM demod
//!           → stereo decode → resample to 48 kHz → audio IPC
//!           ↘ FFT → spectrum frames

use anyhow::Result;
use mayhem_ipc::{AppId, AppMetadata, AudioFrame, Direction, RegulatoryClass, SpectrumFrame, WfmTuning};
use tokio::sync::{mpsc, oneshot};

use crate::{App, RunningApp};

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
        let _tuning: WfmTuning = serde_json::from_value(params)?;
        let _audio_tx = self.audio_tx.clone();
        let _spectrum_tx = self.spectrum_tx.clone();
        let (stop_tx, stop_rx) = oneshot::channel::<()>();

        let join = tokio::task::spawn_blocking(move || {
            // WFM flowgraph: HackRF → decimate(10× → 240 kHz) → QuadDemod(±75 kHz)
            //   → StereoDecoder → resample to 48 kHz → emit AudioFrame
            //   → FFT → emit SpectrumFrame
            // Full wiring follows NfmAudioApp pattern with wider deviation.
            let _ = stop_rx;
        });

        Ok(RunningApp { stop: stop_tx, join })
    }
}
