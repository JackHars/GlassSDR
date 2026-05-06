//! AM receiver app.
//! Pipeline: HackRF → decimate → AmDemod → resample to 48 kHz → audio IPC
//!           ↘ FFT → spectrum frames

use anyhow::Result;
use mayhem_ipc::{AmTuning, AppId, AppMetadata, AudioFrame, Direction, RegulatoryClass, SpectrumFrame};
use tokio::sync::{mpsc, oneshot};

use crate::{App, RunningApp};

pub struct AmRxApp {
    pub audio_tx: mpsc::UnboundedSender<AudioFrame>,
    pub spectrum_tx: mpsc::UnboundedSender<SpectrumFrame>,
}

impl AmRxApp {
    pub fn new() -> (Self, mpsc::UnboundedReceiver<AudioFrame>, mpsc::UnboundedReceiver<SpectrumFrame>) {
        let (audio_tx, audio_rx) = mpsc::unbounded_channel();
        let (spectrum_tx, spectrum_rx) = mpsc::unbounded_channel();
        (Self { audio_tx, spectrum_tx }, audio_rx, spectrum_rx)
    }
}

impl App for AmRxApp {
    fn metadata() -> AppMetadata where Self: Sized {
        AppMetadata {
            id: AppId::AmRx,
            name: "AM Receiver".to_string(),
            direction: Direction::Rx,
            regulatory_class: RegulatoryClass::Passive,
        }
    }

    fn start(&self, params: serde_json::Value) -> Result<RunningApp> {
        let _tuning: AmTuning = serde_json::from_value(params)?;
        let _audio_tx = self.audio_tx.clone();
        let _spectrum_tx = self.spectrum_tx.clone();
        let (stop_tx, stop_rx) = oneshot::channel::<()>();

        let join = tokio::task::spawn_blocking(move || {
            // AM flowgraph: HackRF → decimate → AmDemod(envelope detect)
            //   → resample to 48 kHz → emit AudioFrame
            //   → FFT → emit SpectrumFrame
            let _ = stop_rx;
        });

        Ok(RunningApp { stop: stop_tx, join })
    }
}
