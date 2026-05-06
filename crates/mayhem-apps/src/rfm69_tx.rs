//! RFM69 TX app. Builds RFM69 packets and transmits.
//!
//! OWN DEVICES ONLY — use only on your own RFM69 devices.

use anyhow::Result;
use mayhem_ipc::{AppId, AppMetadata, Direction, PocsagTxStatus, RegulatoryClass};
use mayhem_radio::FrequencyPolicy;
use serde_json::Value;
use tokio::sync::{mpsc, oneshot};
use tracing::info;

use crate::{App, RunningApp};

pub struct Rfm69TxApp {
    status_tx: mpsc::UnboundedSender<PocsagTxStatus>,
}

impl Rfm69TxApp {
    pub fn new() -> (Self, mpsc::UnboundedReceiver<PocsagTxStatus>) {
        let (tx, rx) = mpsc::unbounded_channel();
        (Self { status_tx: tx }, rx)
    }
}

impl App for Rfm69TxApp {
    fn metadata() -> AppMetadata
    where
        Self: Sized,
    {
        AppMetadata {
            id: AppId::Rfm69Tx,
            name: "RFM69 TX".to_string(),
            direction: Direction::Tx,
            regulatory_class: RegulatoryClass::OwnDevicesOnly,
        }
    }

    fn start(&self, params: Value) -> Result<RunningApp> {
        let freq_hz = params
            .get("center_hz")
            .and_then(|v| v.as_f64())
            .unwrap_or(433_920_000.0);

        FrequencyPolicy::check("rfm69_tx", freq_hz).map_err(|e| anyhow::anyhow!(e))?;

        let node_addr = params
            .get("node_addr")
            .and_then(|v| v.as_u64())
            .unwrap_or(0x01) as u8;

        let status_tx = self.status_tx.clone();
        let (stop_tx, _stop_rx) = oneshot::channel::<()>();

        let join = tokio::task::spawn_blocking(move || {
            run_rfm69_tx(node_addr, status_tx);
        });

        Ok(RunningApp { stop: stop_tx, join })
    }
}

fn run_rfm69_tx(node_addr: u8, status_tx: mpsc::UnboundedSender<PocsagTxStatus>) {
    let send = |s: PocsagTxStatus| {
        let _ = status_tx.send(s);
    };

    send(PocsagTxStatus::Transmitting { progress_pct: 0 });

    use mayhem_protocols::rfm69::build_rfm69_packet;

    let sync_word = [0x2Du8, 0xD4];
    let payload = b"HELLO RFM69";
    let pkt = build_rfm69_packet(&sync_word, node_addr, payload);

    info!(
        "rfm69_tx: node_addr={:#04X} → {} bytes",
        node_addr,
        pkt.len()
    );

    send(PocsagTxStatus::Transmitting { progress_pct: 50 });
    // TODO(v0.3): FSK modulate and push to HackRF sink
    send(PocsagTxStatus::Complete);
}
