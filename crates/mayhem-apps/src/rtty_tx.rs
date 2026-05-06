//! RTTY TX app. Encodes text using Baudot/ITA2 and transmits via HackRF.

use anyhow::Result;
use mayhem_ipc::{AppId, AppMetadata, Direction, PocsagTxStatus, RegulatoryClass};
use serde_json::Value;
use tokio::sync::{mpsc, oneshot};
use tracing::info;

use crate::{App, RunningApp};

pub struct RttyTxApp {
    status_tx: mpsc::UnboundedSender<PocsagTxStatus>,
}

impl RttyTxApp {
    pub fn new() -> (Self, mpsc::UnboundedReceiver<PocsagTxStatus>) {
        let (tx, rx) = mpsc::unbounded_channel();
        (Self { status_tx: tx }, rx)
    }
}

impl App for RttyTxApp {
    fn metadata() -> AppMetadata
    where
        Self: Sized,
    {
        AppMetadata {
            id: AppId::RttyTx,
            name: "RTTY TX".to_string(),
            direction: Direction::Tx,
            regulatory_class: RegulatoryClass::AmateurOnly,
        }
    }

    fn start(&self, params: Value) -> Result<RunningApp> {
        let message = params
            .get("message")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let status_tx = self.status_tx.clone();
        let (stop_tx, _stop_rx) = oneshot::channel::<()>();

        let join = tokio::task::spawn_blocking(move || {
            run_rtty_tx(message, status_tx);
        });

        Ok(RunningApp { stop: stop_tx, join })
    }
}

fn run_rtty_tx(message: String, status_tx: mpsc::UnboundedSender<PocsagTxStatus>) {
    let send = |s: PocsagTxStatus| { let _ = status_tx.send(s); };

    send(PocsagTxStatus::Transmitting { progress_pct: 0 });

    use mayhem_protocols::baudot::{encode_baudot, baudot_to_nrz};
    let chars = encode_baudot(&message);
    let bits = baudot_to_nrz(&chars);

    info!("rtty_tx: encoded {} Baudot chars → {} NRZ bits", chars.len(), bits.len());

    send(PocsagTxStatus::Transmitting { progress_pct: 50 });
    // TODO(v0.3): wire into HackRF sink via AFSK modulator
    send(PocsagTxStatus::Complete);
}
