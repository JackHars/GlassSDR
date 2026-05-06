//! RF Characterization app. Sweeps a frequency range and reports power levels.
//!
//! INDOOR TEST ONLY — intentional transmissions; operate only in shielded
//! environments.

use anyhow::Result;
use mayhem_ipc::{AppId, AppMetadata, Direction, PocsagTxStatus, RegulatoryClass};
use mayhem_radio::FrequencyPolicy;
use serde_json::Value;
use tokio::sync::{mpsc, oneshot};
use tracing::info;

use crate::{App, RunningApp};

pub struct RfCharacterizeApp {
    status_tx: mpsc::UnboundedSender<PocsagTxStatus>,
}

impl RfCharacterizeApp {
    pub fn new() -> (Self, mpsc::UnboundedReceiver<PocsagTxStatus>) {
        let (tx, rx) = mpsc::unbounded_channel();
        (Self { status_tx: tx }, rx)
    }
}

impl App for RfCharacterizeApp {
    fn metadata() -> AppMetadata
    where
        Self: Sized,
    {
        AppMetadata {
            id: AppId::RfCharacterize,
            name: "RF Characterization".to_string(),
            direction: Direction::Tx,
            regulatory_class: RegulatoryClass::IndoorTestOnly,
        }
    }

    fn start(&self, params: Value) -> Result<RunningApp> {
        let start_hz = params
            .get("start_hz")
            .and_then(|v| v.as_f64())
            .unwrap_or(88_000_000.0);

        FrequencyPolicy::check("rf_characterize", start_hz).map_err(|e| anyhow::anyhow!(e))?;

        let stop_hz = params
            .get("stop_hz")
            .and_then(|v| v.as_f64())
            .unwrap_or(108_000_000.0);

        let step_hz = params
            .get("step_hz")
            .and_then(|v| v.as_f64())
            .unwrap_or(1_000_000.0);

        let status_tx = self.status_tx.clone();
        let (stop_tx, stop_rx) = oneshot::channel::<()>();

        let join = tokio::task::spawn_blocking(move || {
            run_rf_characterize(start_hz, stop_hz, step_hz, status_tx, stop_rx);
        });

        Ok(RunningApp { stop: stop_tx, join })
    }
}

fn run_rf_characterize(
    start_hz: f64,
    stop_hz: f64,
    step_hz: f64,
    status_tx: mpsc::UnboundedSender<PocsagTxStatus>,
    mut stop_rx: oneshot::Receiver<()>,
) {
    let send = |s: PocsagTxStatus| {
        let _ = status_tx.send(s);
    };

    info!(start_hz, stop_hz, step_hz, "rf_characterize: started (stub)");
    send(PocsagTxStatus::Armed);

    let steps = ((stop_hz - start_hz) / step_hz).ceil() as u64;
    for i in 0..steps {
        if stop_rx.try_recv().is_ok() { break; }
        let pct = ((i * 100) / steps.max(1)) as u8;
        send(PocsagTxStatus::Transmitting { progress_pct: pct });
        // TODO(v0.3): measure power at each step using HackRF.
    }

    send(PocsagTxStatus::Complete);
}
