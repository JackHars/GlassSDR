//! MDC-1200 TX app. Encodes and transmits MDC-1200 packets.
//!
//! OWN DEVICES ONLY — use only on your own licensed radio equipment.

use anyhow::Result;
use mayhem_ipc::{AppId, AppMetadata, Direction, PocsagTxStatus, RegulatoryClass};
use mayhem_radio::FrequencyPolicy;
use serde_json::Value;
use tokio::sync::{mpsc, oneshot};
use tracing::info;

use crate::{App, RunningApp};

pub struct Mdc1200TxApp {
    status_tx: mpsc::UnboundedSender<PocsagTxStatus>,
}

impl Mdc1200TxApp {
    pub fn new() -> (Self, mpsc::UnboundedReceiver<PocsagTxStatus>) {
        let (tx, rx) = mpsc::unbounded_channel();
        (Self { status_tx: tx }, rx)
    }
}

impl App for Mdc1200TxApp {
    fn metadata() -> AppMetadata
    where
        Self: Sized,
    {
        AppMetadata {
            id: AppId::Mdc1200Tx,
            name: "MDC-1200 TX".to_string(),
            direction: Direction::Tx,
            regulatory_class: RegulatoryClass::OwnDevicesOnly,
        }
    }

    fn start(&self, params: Value) -> Result<RunningApp> {
        let freq_hz = params
            .get("center_hz")
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0);

        FrequencyPolicy::check("mdc1200_tx", freq_hz)
            .map_err(|e| anyhow::anyhow!(e))?;

        let unit_id = params
            .get("unit_id")
            .and_then(|v| v.as_u64())
            .unwrap_or(0x1234) as u16;
        let opcode = params
            .get("opcode")
            .and_then(|v| v.as_u64())
            .unwrap_or(0x01) as u8;

        let status_tx = self.status_tx.clone();
        let (stop_tx, _stop_rx) = oneshot::channel::<()>();

        let join = tokio::task::spawn_blocking(move || {
            run_mdc1200_tx(unit_id, opcode, status_tx);
        });

        Ok(RunningApp { stop: stop_tx, join })
    }
}

fn run_mdc1200_tx(
    unit_id: u16,
    opcode: u8,
    status_tx: mpsc::UnboundedSender<PocsagTxStatus>,
) {
    let send = |s: PocsagTxStatus| {
        let _ = status_tx.send(s);
    };

    send(PocsagTxStatus::Transmitting { progress_pct: 0 });

    use mayhem_protocols::mdc1200::{Mdc1200Packet, encode_mdc1200};

    let pkt = Mdc1200Packet { unit_id, opcode };
    let bits = encode_mdc1200(&pkt);

    info!(
        "mdc1200_tx: unit_id={:#06X} opcode={:#04X} → {} bits",
        unit_id, opcode, bits.len()
    );

    send(PocsagTxStatus::Transmitting { progress_pct: 50 });
    // TODO(v0.3): modulate AFSK 1200/1800 Hz and push to HackRF sink
    send(PocsagTxStatus::Complete);
}
