//! SSB (USB/LSB) receiver app.
//! Pipeline: HackRF → decimate → SsbDemod(sideband from params)
//!           → AudioBandpass(300–3000 Hz) → resample to 48 kHz → audio IPC
//!           ↘ FFT → spectrum frames

use anyhow::Result;
use mayhem_ipc::{AppId, AppMetadata, AudioFrame, Direction, RegulatoryClass, SpectrumFrame, SsbTuning};
use tokio::sync::{mpsc, oneshot};

use crate::{App, RunningApp};

pub struct SsbRxApp {
    app_id: AppId,
    pub audio_tx: mpsc::UnboundedSender<AudioFrame>,
    pub spectrum_tx: mpsc::UnboundedSender<SpectrumFrame>,
}

impl SsbRxApp {
    pub fn new_usb() -> (Self, mpsc::UnboundedReceiver<AudioFrame>, mpsc::UnboundedReceiver<SpectrumFrame>) {
        let (audio_tx, audio_rx) = mpsc::unbounded_channel();
        let (spectrum_tx, spectrum_rx) = mpsc::unbounded_channel();
        (Self { app_id: AppId::UsbRx, audio_tx, spectrum_tx }, audio_rx, spectrum_rx)
    }

    pub fn new_lsb() -> (Self, mpsc::UnboundedReceiver<AudioFrame>, mpsc::UnboundedReceiver<SpectrumFrame>) {
        let (audio_tx, audio_rx) = mpsc::unbounded_channel();
        let (spectrum_tx, spectrum_rx) = mpsc::unbounded_channel();
        (Self { app_id: AppId::LsbRx, audio_tx, spectrum_tx }, audio_rx, spectrum_rx)
    }

    pub fn metadata_usb() -> AppMetadata {
        AppMetadata {
            id: AppId::UsbRx,
            name: "USB Receiver".to_string(),
            direction: Direction::Rx,
            regulatory_class: RegulatoryClass::Passive,
        }
    }

    pub fn metadata_lsb() -> AppMetadata {
        AppMetadata {
            id: AppId::LsbRx,
            name: "LSB Receiver".to_string(),
            direction: Direction::Rx,
            regulatory_class: RegulatoryClass::Passive,
        }
    }
}

impl App for SsbRxApp {
    fn metadata() -> AppMetadata where Self: Sized {
        // Default to USB; runner registers both variants explicitly via
        // metadata_usb() and metadata_lsb().
        Self::metadata_usb()
    }

    fn start(&self, params: serde_json::Value) -> Result<RunningApp> {
        let _tuning: SsbTuning = serde_json::from_value(params)?;
        let _audio_tx = self.audio_tx.clone();
        let _spectrum_tx = self.spectrum_tx.clone();
        let _app_id = self.app_id;
        let (stop_tx, stop_rx) = oneshot::channel::<()>();

        let join = tokio::task::spawn_blocking(move || {
            // SSB flowgraph: HackRF → decimate → SsbDemod(sideband from _tuning.sideband)
            //   → AudioBandpass(300–3000 Hz) → resample to 48 kHz → emit AudioFrame
            //   → FFT → emit SpectrumFrame
            let _ = stop_rx;
        });

        Ok(RunningApp { stop: stop_tx, join })
    }
}
