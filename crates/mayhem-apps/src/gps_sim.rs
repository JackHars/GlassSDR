//! GPS Simulator app. Generates GPS L1 C/A signals (stub).
//!
//! INDOOR TEST ONLY — transmitting GPS signals is heavily regulated.

use anyhow::Result;
use mayhem_ipc::{AppId, AppMetadata, Direction, PocsagTxStatus, RegulatoryClass};
use mayhem_radio::FrequencyPolicy;
use serde_json::Value;
use tokio::sync::{mpsc, oneshot};
use tracing::info;

use crate::{App, RunningApp};

const GPS_L1_FREQ_HZ: f64 = 1_575_420_000.0;

pub struct GpsSimApp {
    status_tx: mpsc::UnboundedSender<PocsagTxStatus>,
}

impl GpsSimApp {
    pub fn new() -> (Self, mpsc::UnboundedReceiver<PocsagTxStatus>) {
        let (tx, rx) = mpsc::unbounded_channel();
        (Self { status_tx: tx }, rx)
    }
}

impl App for GpsSimApp {
    fn metadata() -> AppMetadata
    where
        Self: Sized,
    {
        AppMetadata {
            id: AppId::GpsSim,
            name: "GPS Simulator".to_string(),
            direction: Direction::Tx,
            regulatory_class: RegulatoryClass::IndoorTestOnly,
        }
    }

    fn start(&self, params: Value) -> Result<RunningApp> {
        let freq_hz = params
            .get("center_hz")
            .and_then(|v| v.as_f64())
            .unwrap_or(GPS_L1_FREQ_HZ);

        FrequencyPolicy::check("gps_sim", freq_hz)
            .map_err(|e| anyhow::anyhow!(e))?;

        let prn = params.get("prn").and_then(|v| v.as_u64()).unwrap_or(1) as u8;

        let status_tx = self.status_tx.clone();
        let (stop_tx, _stop_rx) = oneshot::channel::<()>();

        let join = tokio::task::spawn_blocking(move || {
            run_gps_sim(prn, status_tx);
        });

        Ok(RunningApp { stop: stop_tx, join })
    }
}

fn run_gps_sim(prn: u8, status_tx: mpsc::UnboundedSender<PocsagTxStatus>) {
    let send = |s: PocsagTxStatus| {
        let _ = status_tx.send(s);
    };

    send(PocsagTxStatus::Transmitting { progress_pct: 0 });

    use mayhem_protocols::gps::generate_ca_code;

    let code = generate_ca_code(prn);
    info!("gps_sim: PRN {} C/A code generated ({} chips)", prn, code.len());

    send(PocsagTxStatus::Transmitting { progress_pct: 50 });
    // TODO(v0.3): modulate and push to HackRF sink
    send(PocsagTxStatus::Complete);
}
