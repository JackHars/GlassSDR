//! BTLE RX app. Passive BLE advertisement sniffer.
//!
//! Passive — no transmission; listens on advertising channels 37/38/39.

use anyhow::Result;
use mayhem_ipc::{AppId, AppMetadata, BleAdvEvent, Direction, RegulatoryClass};
use serde_json::Value;
use tokio::sync::{mpsc, oneshot};

use crate::{App, RunningApp};

pub struct BtleRxApp {
    event_tx: mpsc::UnboundedSender<BleAdvEvent>,
}

impl BtleRxApp {
    pub fn new() -> (Self, mpsc::UnboundedReceiver<BleAdvEvent>) {
        let (tx, rx) = mpsc::unbounded_channel();
        (Self { event_tx: tx }, rx)
    }
}

impl App for BtleRxApp {
    fn metadata() -> AppMetadata
    where
        Self: Sized,
    {
        AppMetadata {
            id: AppId::BtleRx,
            name: "BTLE RX".to_string(),
            direction: Direction::Rx,
            regulatory_class: RegulatoryClass::Passive,
        }
    }

    fn start(&self, params: Value) -> Result<RunningApp> {
        let channel = params
            .get("channel")
            .and_then(|v| v.as_u64())
            .unwrap_or(37) as u8;

        let event_tx = self.event_tx.clone();
        let (stop_tx, stop_rx) = oneshot::channel::<()>();

        let join = tokio::task::spawn_blocking(move || {
            run_btle_rx(channel, event_tx, stop_rx);
        });

        Ok(RunningApp { stop: stop_tx, join })
    }
}

fn run_btle_rx(
    channel: u8,
    event_tx: mpsc::UnboundedSender<BleAdvEvent>,
    mut stop_rx: oneshot::Receiver<()>,
) {
    tracing::info!(channel, "btle_rx: started (stub)");
    // TODO(v0.3): Drive HackRF source → GFSK demod → BLE packet framer.
    // Emit BleAdvEvent per decoded advertisement.
    let _ = stop_rx.try_recv();
    let _ = event_tx;
}
