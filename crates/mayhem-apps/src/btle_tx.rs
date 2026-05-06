//! BTLE TX app. Builds BLE advertising PDUs and transmits via HackRF.
//!
//! OWN DEVICES ONLY — use only on your own BLE devices.

use anyhow::Result;
use mayhem_ipc::{AppId, AppMetadata, Direction, PocsagTxStatus, RegulatoryClass};
use mayhem_radio::FrequencyPolicy;
use serde_json::Value;
use tokio::sync::{mpsc, oneshot};
use tracing::info;

use crate::{App, RunningApp};

pub struct BtleTxApp {
    status_tx: mpsc::UnboundedSender<PocsagTxStatus>,
}

impl BtleTxApp {
    pub fn new() -> (Self, mpsc::UnboundedReceiver<PocsagTxStatus>) {
        let (tx, rx) = mpsc::unbounded_channel();
        (Self { status_tx: tx }, rx)
    }
}

impl App for BtleTxApp {
    fn metadata() -> AppMetadata
    where
        Self: Sized,
    {
        AppMetadata {
            id: AppId::BtleTx,
            name: "BTLE TX".to_string(),
            direction: Direction::Tx,
            regulatory_class: RegulatoryClass::OwnDevicesOnly,
        }
    }

    fn start(&self, params: Value) -> Result<RunningApp> {
        let freq_hz = params
            .get("center_hz")
            .and_then(|v| v.as_f64())
            .unwrap_or(2_402_000_000.0);

        FrequencyPolicy::check("btle_tx", freq_hz).map_err(|e| anyhow::anyhow!(e))?;

        let channel = params
            .get("channel")
            .and_then(|v| v.as_u64())
            .unwrap_or(37) as u8;

        let status_tx = self.status_tx.clone();
        let (stop_tx, _stop_rx) = oneshot::channel::<()>();

        let join = tokio::task::spawn_blocking(move || {
            run_btle_tx(channel, status_tx);
        });

        Ok(RunningApp { stop: stop_tx, join })
    }
}

fn run_btle_tx(channel: u8, status_tx: mpsc::UnboundedSender<PocsagTxStatus>) {
    let send = |s: PocsagTxStatus| {
        let _ = status_tx.send(s);
    };

    send(PocsagTxStatus::Transmitting { progress_pct: 0 });

    use mayhem_protocols::ble::{build_adv_packet, packet_to_symbols};

    let addr = [0x01u8, 0x02, 0x03, 0x04, 0x05, 0x06];
    let adv_data = b"\x02\x01\x06\x04\xFF\xDE\xAD\xBE";
    let pkt = build_adv_packet(&addr, adv_data, channel);
    let symbols = packet_to_symbols(&pkt);

    info!(
        "btle_tx: channel={} → {} bytes / {} symbols",
        channel,
        pkt.bytes.len(),
        symbols.len()
    );

    send(PocsagTxStatus::Transmitting { progress_pct: 50 });
    // TODO(v0.3): push symbols through GFSK modulator → HackRF sink
    send(PocsagTxStatus::Complete);
}
