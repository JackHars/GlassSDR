//! Capture Manager app. Enhanced IQ recording and replay.
//!
//! OWN DEVICES ONLY — replay mode transmits; only replay signals you are
//! authorised to retransmit.

use anyhow::Result;
use mayhem_ipc::{AppId, AppMetadata, Direction, PocsagTxStatus, RegulatoryClass};
use mayhem_radio::FrequencyPolicy;
use serde_json::Value;
use tokio::sync::{mpsc, oneshot};
use tracing::info;

use crate::{App, RunningApp};

pub struct CaptureManagerApp {
    status_tx: mpsc::UnboundedSender<PocsagTxStatus>,
}

impl CaptureManagerApp {
    pub fn new() -> (Self, mpsc::UnboundedReceiver<PocsagTxStatus>) {
        let (tx, rx) = mpsc::unbounded_channel();
        (Self { status_tx: tx }, rx)
    }
}

impl App for CaptureManagerApp {
    fn metadata() -> AppMetadata
    where
        Self: Sized,
    {
        AppMetadata {
            id: AppId::CaptureManager,
            name: "Capture Manager".to_string(),
            direction: Direction::Tx,
            regulatory_class: RegulatoryClass::OwnDevicesOnly,
        }
    }

    fn start(&self, params: Value) -> Result<RunningApp> {
        let freq_hz = params
            .get("center_hz")
            .and_then(|v| v.as_f64())
            .unwrap_or(433_920_000.0);

        FrequencyPolicy::check("capture_manager", freq_hz).map_err(|e| anyhow::anyhow!(e))?;

        let mode = params
            .get("mode")
            .and_then(|v| v.as_str())
            .unwrap_or("record")
            .to_string();

        let threshold_db = params
            .get("threshold_db")
            .and_then(|v| v.as_f64())
            .unwrap_or(-40.0) as f32;

        let status_tx = self.status_tx.clone();
        let (stop_tx, stop_rx) = oneshot::channel::<()>();

        let join = tokio::task::spawn_blocking(move || {
            run_capture_manager(mode, freq_hz, threshold_db, status_tx, stop_rx);
        });

        Ok(RunningApp { stop: stop_tx, join })
    }
}

fn run_capture_manager(
    mode: String,
    freq_hz: f64,
    threshold_db: f32,
    status_tx: mpsc::UnboundedSender<PocsagTxStatus>,
    mut stop_rx: oneshot::Receiver<()>,
) {
    let send = |s: PocsagTxStatus| {
        let _ = status_tx.send(s);
    };

    info!(mode = %mode, freq_hz, threshold_db, "capture_manager: started (stub)");
    send(PocsagTxStatus::Armed);
    // TODO(v0.3): record → write IQ to file; replay → read IQ file → HackRF sink.
    let _ = stop_rx.try_recv();
    send(PocsagTxStatus::Idle);
}
