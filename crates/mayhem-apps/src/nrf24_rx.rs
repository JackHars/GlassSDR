//! NRF24 Sniffer app. Passive nRF24L01+ Enhanced ShockBurst packet sniffer.
//!
//! Passive — no transmission; sniffs packets on a configured channel/address.

use anyhow::Result;
use mayhem_ipc::{AppId, AppMetadata, Direction, OokDecodeEvent, RegulatoryClass};
use serde_json::Value;
use tokio::sync::{mpsc, oneshot};

use crate::{App, RunningApp};

pub struct Nrf24RxApp {
    event_tx: mpsc::UnboundedSender<OokDecodeEvent>,
}

impl Nrf24RxApp {
    pub fn new() -> (Self, mpsc::UnboundedReceiver<OokDecodeEvent>) {
        let (tx, rx) = mpsc::unbounded_channel();
        (Self { event_tx: tx }, rx)
    }
}

impl App for Nrf24RxApp {
    fn metadata() -> AppMetadata
    where
        Self: Sized,
    {
        AppMetadata {
            id: AppId::Nrf24Rx,
            name: "NRF24 Sniffer".to_string(),
            direction: Direction::Rx,
            regulatory_class: RegulatoryClass::Passive,
        }
    }

    fn start(&self, params: Value) -> Result<RunningApp> {
        let channel = params
            .get("channel")
            .and_then(|v| v.as_u64())
            .unwrap_or(76) as u8;

        let event_tx = self.event_tx.clone();
        let (stop_tx, stop_rx) = oneshot::channel::<()>();

        let join = tokio::task::spawn_blocking(move || {
            run_nrf24_rx(channel, event_tx, stop_rx);
        });

        Ok(RunningApp { stop: stop_tx, join })
    }
}

fn run_nrf24_rx(
    channel: u8,
    event_tx: mpsc::UnboundedSender<OokDecodeEvent>,
    mut stop_rx: oneshot::Receiver<()>,
) {
    tracing::info!(channel, "nrf24_rx: started (stub)");
    // TODO(v0.3): HackRF source → GFSK demod → ShockBurst framer → OokDecodeEvent.
    let _ = stop_rx.try_recv();
    let _ = event_tx;
}
