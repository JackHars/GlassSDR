//! ADS-B TX app. Encodes ADS-B position frames and transmits at 1090 MHz.
//!
//! INDOOR TEST ONLY — transmitting on 1090 MHz requires authorization.

use anyhow::Result;
use mayhem_ipc::{AppId, AppMetadata, Direction, PocsagTxStatus, RegulatoryClass};
use mayhem_radio::FrequencyPolicy;
use serde_json::Value;
use tokio::sync::{mpsc, oneshot};
use tracing::info;

use crate::{App, RunningApp};

const ADSB_FREQ_HZ: f64 = 1_090_000_000.0;

pub struct AdsbTxApp {
    status_tx: mpsc::UnboundedSender<PocsagTxStatus>,
}

impl AdsbTxApp {
    pub fn new() -> (Self, mpsc::UnboundedReceiver<PocsagTxStatus>) {
        let (tx, rx) = mpsc::unbounded_channel();
        (Self { status_tx: tx }, rx)
    }
}

impl App for AdsbTxApp {
    fn metadata() -> AppMetadata
    where
        Self: Sized,
    {
        AppMetadata {
            id: AppId::AdsbTx,
            name: "ADS-B TX".to_string(),
            direction: Direction::Tx,
            regulatory_class: RegulatoryClass::IndoorTestOnly,
        }
    }

    fn start(&self, params: Value) -> Result<RunningApp> {
        let freq_hz = params
            .get("center_hz")
            .and_then(|v| v.as_f64())
            .unwrap_or(ADSB_FREQ_HZ);

        FrequencyPolicy::check("adsb_tx", freq_hz)
            .map_err(|e| anyhow::anyhow!(e))?;

        let icao24 = params
            .get("icao24")
            .and_then(|v| v.as_u64())
            .unwrap_or(0xABCDEF) as u32;
        let lat = params.get("lat").and_then(|v| v.as_f64()).unwrap_or(0.0);
        let lon = params.get("lon").and_then(|v| v.as_f64()).unwrap_or(0.0);
        let alt_ft = params
            .get("alt_ft")
            .and_then(|v| v.as_i64())
            .unwrap_or(0) as i32;

        let status_tx = self.status_tx.clone();
        let (stop_tx, _stop_rx) = oneshot::channel::<()>();

        let join = tokio::task::spawn_blocking(move || {
            run_adsb_tx(icao24, lat, lon, alt_ft, status_tx);
        });

        Ok(RunningApp { stop: stop_tx, join })
    }
}

fn run_adsb_tx(
    icao24: u32,
    lat: f64,
    lon: f64,
    alt_ft: i32,
    status_tx: mpsc::UnboundedSender<PocsagTxStatus>,
) {
    let send = |s: PocsagTxStatus| {
        let _ = status_tx.send(s);
    };

    send(PocsagTxStatus::Transmitting { progress_pct: 0 });

    use mayhem_protocols::adsb_tx::{AdsbTxEncParams, encode_adsb_position, adsb_to_ppm};

    let p = AdsbTxEncParams { icao24, lat, lon, alt_ft };
    let frame = encode_adsb_position(&p);
    let ppm = adsb_to_ppm(&frame);

    info!(
        "adsb_tx: ICAO24={:06X} lat={:.4} lon={:.4} alt={}ft → {} PPM symbols",
        icao24, lat, lon, alt_ft, ppm.len()
    );

    send(PocsagTxStatus::Transmitting { progress_pct: 50 });
    // TODO(v0.3): push PPM symbols to HackRF sink at 2 Msps OOK
    send(PocsagTxStatus::Complete);
}
