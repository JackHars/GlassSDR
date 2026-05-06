//! NRF24 TX app. Builds nRF24L01+ Enhanced ShockBurst frames and transmits.
//!
//! OWN DEVICES ONLY — use only on your own nRF24 devices.

use anyhow::Result;
use mayhem_ipc::{AppId, AppMetadata, Direction, PocsagTxStatus, RegulatoryClass};
use mayhem_radio::FrequencyPolicy;
use serde_json::Value;
use tokio::sync::{mpsc, oneshot};
use tracing::info;

use crate::{App, RunningApp};

pub struct Nrf24TxApp {
    status_tx: mpsc::UnboundedSender<PocsagTxStatus>,
}

impl Nrf24TxApp {
    pub fn new() -> (Self, mpsc::UnboundedReceiver<PocsagTxStatus>) {
        let (tx, rx) = mpsc::unbounded_channel();
        (Self { status_tx: tx }, rx)
    }
}

impl App for Nrf24TxApp {
    fn metadata() -> AppMetadata
    where
        Self: Sized,
    {
        AppMetadata {
            id: AppId::Nrf24Tx,
            name: "NRF24 TX".to_string(),
            direction: Direction::Tx,
            regulatory_class: RegulatoryClass::OwnDevicesOnly,
        }
    }

    fn start(&self, params: Value) -> Result<RunningApp> {
        let freq_hz = params
            .get("center_hz")
            .and_then(|v| v.as_f64())
            .unwrap_or(2_400_000_000.0);

        FrequencyPolicy::check("nrf24_tx", freq_hz).map_err(|e| anyhow::anyhow!(e))?;

        let status_tx = self.status_tx.clone();
        let (stop_tx, _stop_rx) = oneshot::channel::<()>();

        let join = tokio::task::spawn_blocking(move || {
            run_nrf24_tx(status_tx);
        });

        Ok(RunningApp { stop: stop_tx, join })
    }
}

fn run_nrf24_tx(status_tx: mpsc::UnboundedSender<PocsagTxStatus>) {
    let send = |s: PocsagTxStatus| {
        let _ = status_tx.send(s);
    };

    send(PocsagTxStatus::Transmitting { progress_pct: 0 });

    use mayhem_protocols::nrf24::{build_shockburst, packet_to_symbols};

    let address = [0xE7u8, 0xE7, 0xE7, 0xE7, 0xE7];
    let payload = b"HELLO";
    let pkt = build_shockburst(&address, payload);
    let symbols = packet_to_symbols(&pkt);

    info!(
        "nrf24_tx: {} bytes / {} symbols",
        pkt.bytes.len(),
        symbols.len()
    );

    send(PocsagTxStatus::Transmitting { progress_pct: 50 });
    // TODO(v0.3): GFSK modulate and push to HackRF sink
    send(PocsagTxStatus::Complete);
}
