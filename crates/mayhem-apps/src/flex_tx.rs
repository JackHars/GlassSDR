//! FLEX TX app. Encodes a FLEX pager message and transmits via HackRF.

use anyhow::Result;
use mayhem_ipc::{AppId, AppMetadata, Direction, PocsagTxStatus, RegulatoryClass};
use serde_json::Value;
use tokio::sync::{mpsc, oneshot};
use tracing::info;

use crate::{App, RunningApp};

pub struct FlexTxApp {
    status_tx: mpsc::UnboundedSender<PocsagTxStatus>,
}

impl FlexTxApp {
    pub fn new() -> (Self, mpsc::UnboundedReceiver<PocsagTxStatus>) {
        let (tx, rx) = mpsc::unbounded_channel();
        (Self { status_tx: tx }, rx)
    }
}

impl App for FlexTxApp {
    fn metadata() -> AppMetadata
    where
        Self: Sized,
    {
        AppMetadata {
            id: AppId::FlexTx,
            name: "FLEX TX".to_string(),
            direction: Direction::Tx,
            regulatory_class: RegulatoryClass::AmateurOnly,
        }
    }

    fn start(&self, params: Value) -> Result<RunningApp> {
        let capcode = params.get("capcode").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
        let message = params
            .get("message")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let status_tx = self.status_tx.clone();
        let (stop_tx, _stop_rx) = oneshot::channel::<()>();

        let join = tokio::task::spawn_blocking(move || {
            run_flex_tx(capcode, message, status_tx);
        });

        Ok(RunningApp { stop: stop_tx, join })
    }
}

fn run_flex_tx(capcode: u32, message: String, status_tx: mpsc::UnboundedSender<PocsagTxStatus>) {
    let send = |s: PocsagTxStatus| { let _ = status_tx.send(s); };

    send(PocsagTxStatus::Transmitting { progress_pct: 0 });

    info!(
        "flex_tx: capcode={} message='{}' (FLEX encoding placeholder)",
        capcode, message
    );

    send(PocsagTxStatus::Transmitting { progress_pct: 50 });
    // TODO(v0.3): implement FLEX encoder and push to HackRF sink
    send(PocsagTxStatus::Complete);
}
