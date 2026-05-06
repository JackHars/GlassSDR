//! Replay TX app. Replays a captured IQ recording via HackRF.
//!
//! OWN DEVICES ONLY — replaying signals at arbitrary frequencies may cause
//! interference. Use only on your own licensed devices and frequencies.

use anyhow::Result;
use mayhem_ipc::{AppId, AppMetadata, Direction, PocsagTxStatus, RegulatoryClass};
use mayhem_radio::FrequencyPolicy;
use serde_json::Value;
use tokio::sync::{mpsc, oneshot};
use tracing::info;

use crate::{App, RunningApp};

pub struct ReplayTxApp {
    status_tx: mpsc::UnboundedSender<PocsagTxStatus>,
}

impl ReplayTxApp {
    pub fn new() -> (Self, mpsc::UnboundedReceiver<PocsagTxStatus>) {
        let (tx, rx) = mpsc::unbounded_channel();
        (Self { status_tx: tx }, rx)
    }
}

impl App for ReplayTxApp {
    fn metadata() -> AppMetadata
    where
        Self: Sized,
    {
        AppMetadata {
            id: AppId::ReplayTx,
            name: "Replay TX".to_string(),
            direction: Direction::Tx,
            regulatory_class: RegulatoryClass::OwnDevicesOnly,
        }
    }

    fn start(&self, params: Value) -> Result<RunningApp> {
        let freq_hz = params
            .get("center_hz")
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0);

        FrequencyPolicy::check("replay", freq_hz)
            .map_err(|e| anyhow::anyhow!(e))?;

        let file_path = params
            .get("file_path")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let status_tx = self.status_tx.clone();
        let (stop_tx, _stop_rx) = oneshot::channel::<()>();

        let join = tokio::task::spawn_blocking(move || {
            run_replay_tx(file_path, freq_hz, status_tx);
        });

        Ok(RunningApp { stop: stop_tx, join })
    }
}

fn run_replay_tx(
    file_path: String,
    freq_hz: f64,
    status_tx: mpsc::UnboundedSender<PocsagTxStatus>,
) {
    let send = |s: PocsagTxStatus| {
        let _ = status_tx.send(s);
    };

    send(PocsagTxStatus::Transmitting { progress_pct: 0 });

    info!(
        "replay_tx: replaying '{}' at {:.3} MHz",
        file_path,
        freq_hz / 1e6
    );

    send(PocsagTxStatus::Transmitting { progress_pct: 50 });
    // TODO(v0.3): load IQ file and stream to HackRF sink
    send(PocsagTxStatus::Complete);
}
