//! OOK Editor TX app. Transmit custom OOK pulse patterns via HackRF.
//!
//! OWN DEVICES ONLY — use only on your own licensed devices and frequencies.

use anyhow::Result;
use mayhem_ipc::{AppId, AppMetadata, Direction, PocsagTxStatus, RegulatoryClass};
use mayhem_radio::FrequencyPolicy;
use serde_json::Value;
use tokio::sync::{mpsc, oneshot};
use tracing::info;

use crate::{App, RunningApp};

pub struct OokEditorTxApp {
    status_tx: mpsc::UnboundedSender<PocsagTxStatus>,
}

impl OokEditorTxApp {
    pub fn new() -> (Self, mpsc::UnboundedReceiver<PocsagTxStatus>) {
        let (tx, rx) = mpsc::unbounded_channel();
        (Self { status_tx: tx }, rx)
    }
}

impl App for OokEditorTxApp {
    fn metadata() -> AppMetadata
    where
        Self: Sized,
    {
        AppMetadata {
            id: AppId::OokEditorTx,
            name: "OOK Editor TX".to_string(),
            direction: Direction::Tx,
            regulatory_class: RegulatoryClass::OwnDevicesOnly,
        }
    }

    fn start(&self, params: Value) -> Result<RunningApp> {
        let freq_hz = params
            .get("center_hz")
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0);

        FrequencyPolicy::check("ook_editor_tx", freq_hz)
            .map_err(|e| anyhow::anyhow!(e))?;

        let pattern: Vec<u8> = params
            .get("pattern")
            .and_then(|v| v.as_array())
            .map(|arr| arr.iter().filter_map(|x| x.as_u64().map(|n| n as u8)).collect())
            .unwrap_or_default();

        let status_tx = self.status_tx.clone();
        let (stop_tx, _stop_rx) = oneshot::channel::<()>();

        let join = tokio::task::spawn_blocking(move || {
            run_ook_editor_tx(pattern, freq_hz, status_tx);
        });

        Ok(RunningApp { stop: stop_tx, join })
    }
}

fn run_ook_editor_tx(
    pattern: Vec<u8>,
    freq_hz: f64,
    status_tx: mpsc::UnboundedSender<PocsagTxStatus>,
) {
    let send = |s: PocsagTxStatus| {
        let _ = status_tx.send(s);
    };

    send(PocsagTxStatus::Transmitting { progress_pct: 0 });

    info!(
        "ook_editor_tx: {} symbols at {:.3} MHz",
        pattern.len(),
        freq_hz / 1e6
    );

    send(PocsagTxStatus::Transmitting { progress_pct: 50 });
    // TODO(v0.3): convert pattern to OOK IQ and push to HackRF sink
    send(PocsagTxStatus::Complete);
}
