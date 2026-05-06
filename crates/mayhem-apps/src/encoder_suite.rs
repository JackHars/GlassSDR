//! Encoder Suite app. Multi-protocol OOK encoder (PT2262, EV1527, etc.).
//!
//! OWN DEVICES ONLY — transmit only to devices you own.

use anyhow::Result;
use mayhem_ipc::{AppId, AppMetadata, Direction, PocsagTxStatus, RegulatoryClass};
use mayhem_radio::FrequencyPolicy;
use serde_json::Value;
use tokio::sync::{mpsc, oneshot};
use tracing::info;

use crate::{App, RunningApp};

pub struct EncoderSuiteApp {
    status_tx: mpsc::UnboundedSender<PocsagTxStatus>,
}

impl EncoderSuiteApp {
    pub fn new() -> (Self, mpsc::UnboundedReceiver<PocsagTxStatus>) {
        let (tx, rx) = mpsc::unbounded_channel();
        (Self { status_tx: tx }, rx)
    }
}

impl App for EncoderSuiteApp {
    fn metadata() -> AppMetadata
    where
        Self: Sized,
    {
        AppMetadata {
            id: AppId::EncoderSuite,
            name: "Encoder Suite".to_string(),
            direction: Direction::Tx,
            regulatory_class: RegulatoryClass::OwnDevicesOnly,
        }
    }

    fn start(&self, params: Value) -> Result<RunningApp> {
        let freq_hz = params
            .get("center_hz")
            .and_then(|v| v.as_f64())
            .unwrap_or(433_920_000.0);

        FrequencyPolicy::check("encoder_suite", freq_hz).map_err(|e| anyhow::anyhow!(e))?;

        let protocol = params
            .get("protocol")
            .and_then(|v| v.as_str())
            .unwrap_or("pt2262")
            .to_string();

        let code = params
            .get("code")
            .and_then(|v| v.as_str())
            .unwrap_or("000000000000")
            .to_string();

        let status_tx = self.status_tx.clone();
        let (stop_tx, _stop_rx) = oneshot::channel::<()>();

        let join = tokio::task::spawn_blocking(move || {
            run_encoder_suite(protocol, code, freq_hz, status_tx);
        });

        Ok(RunningApp { stop: stop_tx, join })
    }
}

fn run_encoder_suite(
    protocol: String,
    code: String,
    freq_hz: f64,
    status_tx: mpsc::UnboundedSender<PocsagTxStatus>,
) {
    let send = |s: PocsagTxStatus| {
        let _ = status_tx.send(s);
    };

    send(PocsagTxStatus::Armed);
    info!(protocol = %protocol, code = %code, freq_hz, "encoder_suite: encoding (stub)");
    send(PocsagTxStatus::Transmitting { progress_pct: 0 });
    // TODO(v0.3): Route through PT2262/EV1527/HCS300 encoder → OOK modulator → HackRF sink.
    send(PocsagTxStatus::Transmitting { progress_pct: 100 });
    send(PocsagTxStatus::Complete);
}
