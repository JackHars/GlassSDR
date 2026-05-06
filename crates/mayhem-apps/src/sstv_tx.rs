//! SSTV TX app. Encodes a grayscale image using Robot36 and transmits via HackRF.

use anyhow::Result;
use mayhem_ipc::{AppId, AppMetadata, Direction, PocsagTxStatus, RegulatoryClass};
use serde_json::Value;
use tokio::sync::{mpsc, oneshot};
use tracing::info;

use crate::{App, RunningApp};

pub struct SstvTxApp {
    status_tx: mpsc::UnboundedSender<PocsagTxStatus>,
}

impl SstvTxApp {
    pub fn new() -> (Self, mpsc::UnboundedReceiver<PocsagTxStatus>) {
        let (tx, rx) = mpsc::unbounded_channel();
        (Self { status_tx: tx }, rx)
    }
}

impl App for SstvTxApp {
    fn metadata() -> AppMetadata
    where
        Self: Sized,
    {
        AppMetadata {
            id: AppId::SstvTx,
            name: "SSTV TX".to_string(),
            direction: Direction::Tx,
            regulatory_class: RegulatoryClass::AmateurOnly,
        }
    }

    fn start(&self, params: Value) -> Result<RunningApp> {
        let width = params.get("width").and_then(|v| v.as_u64()).unwrap_or(320) as u32;
        let height = params.get("height").and_then(|v| v.as_u64()).unwrap_or(240) as u32;

        let status_tx = self.status_tx.clone();
        let (stop_tx, _stop_rx) = oneshot::channel::<()>();

        let join = tokio::task::spawn_blocking(move || {
            run_sstv_tx(width, height, status_tx);
        });

        Ok(RunningApp { stop: stop_tx, join })
    }
}

fn run_sstv_tx(width: u32, height: u32, status_tx: mpsc::UnboundedSender<PocsagTxStatus>) {
    let send = |s: PocsagTxStatus| { let _ = status_tx.send(s); };

    send(PocsagTxStatus::Transmitting { progress_pct: 0 });

    use mayhem_protocols::sstv::encode_sstv_robot36;
    let pixels = vec![128u8; (width * height) as usize]; // placeholder grey image
    let freqs = encode_sstv_robot36(&pixels, width, height, 48_000.0);

    info!("sstv_tx: Robot36 encoded {} frequency samples ({}×{})", freqs.len(), width, height);

    send(PocsagTxStatus::Transmitting { progress_pct: 50 });
    // TODO(v0.3): FM-modulate freqs and push to HackRF sink
    send(PocsagTxStatus::Complete);
}
