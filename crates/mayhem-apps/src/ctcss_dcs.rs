//! CTCSS/DCS Decoder app. Detects sub-audible CTCSS tones and DCS codes.

use anyhow::Result;
use mayhem_ipc::{AppId, AppMetadata, CtcssDetectEvent, Direction, RegulatoryClass};
use serde_json::Value;
use tokio::sync::{mpsc, oneshot};
use tracing::info;

use crate::{App, RunningApp};

pub struct CtcssDcsApp {
    event_tx: mpsc::UnboundedSender<CtcssDetectEvent>,
}

impl CtcssDcsApp {
    pub fn new() -> (Self, mpsc::UnboundedReceiver<CtcssDetectEvent>) {
        let (tx, rx) = mpsc::unbounded_channel();
        (Self { event_tx: tx }, rx)
    }
}

impl App for CtcssDcsApp {
    fn metadata() -> AppMetadata
    where
        Self: Sized,
    {
        AppMetadata {
            id: AppId::CtcssDcs,
            name: "CTCSS/DCS Decoder".to_string(),
            direction: Direction::Rx,
            regulatory_class: RegulatoryClass::Passive,
        }
    }

    fn start(&self, params: Value) -> Result<RunningApp> {
        let center_hz = params
            .get("center_hz")
            .and_then(|v| v.as_f64())
            .unwrap_or(146_520_000.0);

        let event_tx = self.event_tx.clone();
        let (stop_tx, mut stop_rx) = oneshot::channel::<()>();

        let join = tokio::task::spawn_blocking(move || {
            info!(center_hz, "ctcss_dcs: started (stub)");
            // TODO(v0.3): HackRF → NFM demod → mayhem_dsp::ctcss::detect_ctcss
            //             → CtcssDetectEvent stream.
            let _ = stop_rx.try_recv();
            // Emit a silent idle event so the frontend has something to display.
            let _ = event_tx.send(CtcssDetectEvent { tone_hz: 0.0, power_db: -120.0 });
        });

        Ok(RunningApp { stop: stop_tx, join })
    }
}
