//! RDS decoder app.
//! Pipeline: WFM pipeline → 57 kHz BPF → BPSK demod → RDS group decode
//!           → emit RdsData IPC events
//!           ↘ audio + spectrum frames (same as WFM)

use anyhow::Result;
use mayhem_ipc::{AppId, AppMetadata, AudioFrame, Direction, RdsData, RegulatoryClass, SpectrumFrame, WfmTuning};
use tokio::sync::{mpsc, oneshot};

use crate::{App, RunningApp};

pub struct RdsRxApp {
    pub audio_tx: mpsc::UnboundedSender<AudioFrame>,
    pub spectrum_tx: mpsc::UnboundedSender<SpectrumFrame>,
    pub rds_tx: mpsc::UnboundedSender<RdsData>,
}

impl RdsRxApp {
    pub fn new() -> (
        Self,
        mpsc::UnboundedReceiver<AudioFrame>,
        mpsc::UnboundedReceiver<SpectrumFrame>,
        mpsc::UnboundedReceiver<RdsData>,
    ) {
        let (audio_tx, audio_rx) = mpsc::unbounded_channel();
        let (spectrum_tx, spectrum_rx) = mpsc::unbounded_channel();
        let (rds_tx, rds_rx) = mpsc::unbounded_channel();
        (Self { audio_tx, spectrum_tx, rds_tx }, audio_rx, spectrum_rx, rds_rx)
    }
}

impl App for RdsRxApp {
    fn metadata() -> AppMetadata where Self: Sized {
        AppMetadata {
            id: AppId::RdsRx,
            name: "RDS Decoder".to_string(),
            direction: Direction::Rx,
            regulatory_class: RegulatoryClass::Passive,
        }
    }

    fn start(&self, params: serde_json::Value) -> Result<RunningApp> {
        let _tuning: WfmTuning = serde_json::from_value(params)?;
        let _audio_tx = self.audio_tx.clone();
        let _spectrum_tx = self.spectrum_tx.clone();
        let _rds_tx = self.rds_tx.clone();
        let (stop_tx, stop_rx) = oneshot::channel::<()>();

        let join = tokio::task::spawn_blocking(move || {
            // RDS flowgraph: HackRF → decimate → WfmDemod → stereo decode
            //   → 57 kHz BPF → BPSK demod → RDS group decode → emit RdsData
            //   → resample to 48 kHz → emit AudioFrame
            //   → FFT → emit SpectrumFrame
            let _ = stop_rx;
        });

        Ok(RunningApp { stop: stop_tx, join })
    }
}
