//! AFSK TX app. Generates AFSK audio from binary data and transmits via HackRF.

use anyhow::Result;
use mayhem_ipc::{AppId, AppMetadata, Direction, PocsagTxStatus, RegulatoryClass};
use serde_json::Value;
use tokio::sync::{mpsc, oneshot};
use tracing::info;

use crate::{App, RunningApp};

pub struct AfskTxApp {
    status_tx: mpsc::UnboundedSender<PocsagTxStatus>,
}

impl AfskTxApp {
    pub fn new() -> (Self, mpsc::UnboundedReceiver<PocsagTxStatus>) {
        let (tx, rx) = mpsc::unbounded_channel();
        (Self { status_tx: tx }, rx)
    }
}

impl App for AfskTxApp {
    fn metadata() -> AppMetadata
    where
        Self: Sized,
    {
        AppMetadata {
            id: AppId::AfskTx,
            name: "AFSK TX".to_string(),
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
        let mark_hz = params.get("mark_hz").and_then(|v| v.as_f64()).unwrap_or(1200.0) as f32;
        let space_hz = params.get("space_hz").and_then(|v| v.as_f64()).unwrap_or(2200.0) as f32;
        let baud = params.get("baud").and_then(|v| v.as_f64()).unwrap_or(1200.0) as f32;

        let status_tx = self.status_tx.clone();
        let (stop_tx, _stop_rx) = oneshot::channel::<()>();

        let join = tokio::task::spawn_blocking(move || {
            run_afsk_tx(message, mark_hz, space_hz, baud, status_tx);
        });

        Ok(RunningApp { stop: stop_tx, join })
    }
}

fn run_afsk_tx(
    message: String,
    mark_hz: f32,
    space_hz: f32,
    baud: f32,
    status_tx: mpsc::UnboundedSender<PocsagTxStatus>,
) {
    let send = |s: PocsagTxStatus| { let _ = status_tx.send(s); };

    send(PocsagTxStatus::Transmitting { progress_pct: 0 });

    use mayhem_dsp::afsk_mod::afsk_modulate;
    let bits: Vec<u8> = message.bytes().flat_map(|b| (0..8).map(move |i| (b >> i) & 1)).collect();
    let audio = afsk_modulate(&bits, mark_hz, space_hz, baud, 48_000.0);

    info!("afsk_tx: {} bytes → {} audio samples at {} baud", message.len(), audio.len(), baud);

    send(PocsagTxStatus::Transmitting { progress_pct: 50 });
    // TODO(v0.3): FM-modulate audio and push to HackRF sink
    send(PocsagTxStatus::Complete);
}
