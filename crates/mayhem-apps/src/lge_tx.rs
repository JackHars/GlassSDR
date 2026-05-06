//! LGE TX app. Encodes LGE appliance protocol signals.
//!
//! OWN DEVICES ONLY — use only on your own LGE appliances.

use anyhow::Result;
use mayhem_ipc::{AppId, AppMetadata, Direction, PocsagTxStatus, RegulatoryClass};
use mayhem_radio::FrequencyPolicy;
use serde_json::Value;
use tokio::sync::{mpsc, oneshot};
use tracing::info;

use crate::{App, RunningApp};

pub struct LgeTxApp {
    status_tx: mpsc::UnboundedSender<PocsagTxStatus>,
}

impl LgeTxApp {
    pub fn new() -> (Self, mpsc::UnboundedReceiver<PocsagTxStatus>) {
        let (tx, rx) = mpsc::unbounded_channel();
        (Self { status_tx: tx }, rx)
    }
}

impl App for LgeTxApp {
    fn metadata() -> AppMetadata
    where
        Self: Sized,
    {
        AppMetadata {
            id: AppId::LgeTx,
            name: "LGE TX".to_string(),
            direction: Direction::Tx,
            regulatory_class: RegulatoryClass::OwnDevicesOnly,
        }
    }

    fn start(&self, params: Value) -> Result<RunningApp> {
        let freq_hz = params
            .get("center_hz")
            .and_then(|v| v.as_f64())
            .unwrap_or(433_920_000.0);

        FrequencyPolicy::check("lge_tx", freq_hz).map_err(|e| anyhow::anyhow!(e))?;

        let device_addr = params
            .get("device_addr")
            .and_then(|v| v.as_u64())
            .unwrap_or(0x01) as u8;
        let command = params
            .get("command")
            .and_then(|v| v.as_u64())
            .unwrap_or(0x00) as u8;

        let status_tx = self.status_tx.clone();
        let (stop_tx, _stop_rx) = oneshot::channel::<()>();

        let join = tokio::task::spawn_blocking(move || {
            run_lge_tx(device_addr, command, status_tx);
        });

        Ok(RunningApp { stop: stop_tx, join })
    }
}

fn run_lge_tx(device_addr: u8, command: u8, status_tx: mpsc::UnboundedSender<PocsagTxStatus>) {
    let send = |s: PocsagTxStatus| {
        let _ = status_tx.send(s);
    };

    send(PocsagTxStatus::Transmitting { progress_pct: 0 });

    use mayhem_protocols::lge::encode_lge;

    let bits = encode_lge(device_addr, command);

    info!(
        "lge_tx: device_addr={:#04X} command={:#04X} → {} bits",
        device_addr,
        command,
        bits.len()
    );

    send(PocsagTxStatus::Transmitting { progress_pct: 50 });
    // TODO(v0.3): OOK/ASK modulate and push to HackRF sink
    send(PocsagTxStatus::Complete);
}
