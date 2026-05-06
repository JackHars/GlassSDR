//! Keyfob TX app. Encodes PT2262/EV1527 fixed-code keyfob signals.
//!
//! OWN DEVICES ONLY — use only on your own devices.

use anyhow::Result;
use mayhem_ipc::{AppId, AppMetadata, Direction, PocsagTxStatus, RegulatoryClass};
use mayhem_radio::FrequencyPolicy;
use serde_json::Value;
use tokio::sync::{mpsc, oneshot};
use tracing::info;

use crate::{App, RunningApp};

pub struct KeyfobTxApp {
    status_tx: mpsc::UnboundedSender<PocsagTxStatus>,
}

impl KeyfobTxApp {
    pub fn new() -> (Self, mpsc::UnboundedReceiver<PocsagTxStatus>) {
        let (tx, rx) = mpsc::unbounded_channel();
        (Self { status_tx: tx }, rx)
    }
}

impl App for KeyfobTxApp {
    fn metadata() -> AppMetadata
    where
        Self: Sized,
    {
        AppMetadata {
            id: AppId::KeyfobTx,
            name: "Keyfob TX".to_string(),
            direction: Direction::Tx,
            regulatory_class: RegulatoryClass::OwnDevicesOnly,
        }
    }

    fn start(&self, params: Value) -> Result<RunningApp> {
        let freq_hz = params
            .get("center_hz")
            .and_then(|v| v.as_f64())
            .unwrap_or(433_920_000.0);

        FrequencyPolicy::check("keyfob_tx", freq_hz).map_err(|e| anyhow::anyhow!(e))?;

        let code = params
            .get("code")
            .and_then(|v| v.as_u64())
            .unwrap_or(0xABCDE) as u32;
        let bits = params
            .get("bits")
            .and_then(|v| v.as_u64())
            .unwrap_or(24) as u8;
        let repeats = params
            .get("repeats")
            .and_then(|v| v.as_u64())
            .unwrap_or(3) as u32;

        let status_tx = self.status_tx.clone();
        let (stop_tx, _stop_rx) = oneshot::channel::<()>();

        let join = tokio::task::spawn_blocking(move || {
            run_keyfob_tx(code, bits, repeats, status_tx);
        });

        Ok(RunningApp { stop: stop_tx, join })
    }
}

fn run_keyfob_tx(
    code: u32,
    bits: u8,
    repeats: u32,
    status_tx: mpsc::UnboundedSender<PocsagTxStatus>,
) {
    let send = |s: PocsagTxStatus| {
        let _ = status_tx.send(s);
    };

    send(PocsagTxStatus::Transmitting { progress_pct: 0 });

    use mayhem_protocols::keyfob::{encode_pt2262, pulses_to_baseband};

    let pulses = encode_pt2262(code, bits, repeats);
    let bb = pulses_to_baseband(&pulses, 250_000.0);

    info!(
        "keyfob_tx: code={:#X} bits={} repeats={} → {} pulses / {} samples",
        code,
        bits,
        repeats,
        pulses.len(),
        bb.len()
    );

    send(PocsagTxStatus::Transmitting { progress_pct: 50 });
    // TODO(v0.3): push baseband to HackRF sink
    send(PocsagTxStatus::Complete);
}
