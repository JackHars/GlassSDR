//! IQ File Player app. Reads a recorded IQ file and streams it as SpectrumFrames.

use anyhow::Result;
use mayhem_ipc::{AppId, AppMetadata, Direction, RegulatoryClass, SpectrumFrame};
use serde_json::Value;
use tokio::sync::{mpsc, oneshot};
use tracing::info;

use crate::{App, RunningApp};

pub struct IqPlayerApp {
    spec_tx: mpsc::UnboundedSender<SpectrumFrame>,
}

impl IqPlayerApp {
    pub fn new() -> (Self, mpsc::UnboundedReceiver<SpectrumFrame>) {
        let (tx, rx) = mpsc::unbounded_channel();
        (Self { spec_tx: tx }, rx)
    }
}

impl App for IqPlayerApp {
    fn metadata() -> AppMetadata
    where
        Self: Sized,
    {
        AppMetadata {
            id: AppId::IqPlayer,
            name: "IQ File Player".to_string(),
            direction: Direction::Rx,
            regulatory_class: RegulatoryClass::Passive,
        }
    }

    fn start(&self, params: Value) -> Result<RunningApp> {
        let file_path = params
            .get("file_path")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let format = params
            .get("format")
            .and_then(|v| v.as_str())
            .unwrap_or("cs8")
            .to_string();

        let center_hz = params
            .get("center_hz")
            .and_then(|v| v.as_f64())
            .unwrap_or(100_000_000.0);

        let spec_tx = self.spec_tx.clone();
        let (stop_tx, mut stop_rx) = oneshot::channel::<()>();

        let join = tokio::task::spawn_blocking(move || {
            info!(file_path = %file_path, format = %format, center_hz, "iq_player: started (stub)");
            // TODO(v0.3): open file, decode IQ samples by format, compute FFT frames.
            let _ = stop_rx.try_recv();
            let _ = spec_tx.send(SpectrumFrame {
                seq: 0,
                bins: vec![0u8; 256],
                center_hz,
                span_hz: 2_000_000.0,
            });
        });

        Ok(RunningApp { stop: stop_tx, join })
    }
}
