//! Flipper TX app. Parses Flipper Zero .sub files and transmits the baseband.
//!
//! OWN DEVICES ONLY — use only on your own licensed devices.

use anyhow::Result;
use mayhem_ipc::{AppId, AppMetadata, Direction, PocsagTxStatus, RegulatoryClass};
use mayhem_radio::FrequencyPolicy;
use serde_json::Value;
use tokio::sync::{mpsc, oneshot};
use tracing::info;

use crate::{App, RunningApp};

pub struct FlipperTxApp {
    status_tx: mpsc::UnboundedSender<PocsagTxStatus>,
}

impl FlipperTxApp {
    pub fn new() -> (Self, mpsc::UnboundedReceiver<PocsagTxStatus>) {
        let (tx, rx) = mpsc::unbounded_channel();
        (Self { status_tx: tx }, rx)
    }
}

impl App for FlipperTxApp {
    fn metadata() -> AppMetadata
    where
        Self: Sized,
    {
        AppMetadata {
            id: AppId::FlipperTx,
            name: "Flipper TX".to_string(),
            direction: Direction::Tx,
            regulatory_class: RegulatoryClass::OwnDevicesOnly,
        }
    }

    fn start(&self, params: Value) -> Result<RunningApp> {
        let sub_content = params
            .get("sub_content")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let freq_hz = params
            .get("center_hz")
            .and_then(|v| v.as_f64())
            .unwrap_or(433_920_000.0);

        FrequencyPolicy::check("flipper_tx", freq_hz).map_err(|e| anyhow::anyhow!(e))?;

        let status_tx = self.status_tx.clone();
        let (stop_tx, _stop_rx) = oneshot::channel::<()>();

        let join = tokio::task::spawn_blocking(move || {
            run_flipper_tx(sub_content, status_tx);
        });

        Ok(RunningApp { stop: stop_tx, join })
    }
}

fn run_flipper_tx(sub_content: String, status_tx: mpsc::UnboundedSender<PocsagTxStatus>) {
    let send = |s: PocsagTxStatus| {
        let _ = status_tx.send(s);
    };

    send(PocsagTxStatus::Transmitting { progress_pct: 0 });

    use mayhem_protocols::flipper::{parse_sub_file, sub_to_baseband};

    match parse_sub_file(&sub_content) {
        None => {
            send(PocsagTxStatus::Error {
                message: "Failed to parse .sub file".to_string(),
            });
            return;
        }
        Some(sub) => {
            let bb = sub_to_baseband(&sub, 250_000.0);
            info!(
                "flipper_tx: freq={:.0} Hz → {} baseband samples",
                sub.frequency,
                bb.len()
            );
            send(PocsagTxStatus::Transmitting { progress_pct: 50 });
            // TODO(v0.3): push baseband to HackRF sink at sub.frequency
        }
    }

    send(PocsagTxStatus::Complete);
}
