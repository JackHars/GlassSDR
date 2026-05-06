//! Frequency Hopper app. Transmits a tone that hops across a list of frequencies.
//!
//! INDOOR TEST ONLY — frequency hopping transmissions require special authorization.

use anyhow::Result;
use mayhem_ipc::{AppId, AppMetadata, Direction, PocsagTxStatus, RegulatoryClass};
use mayhem_radio::FrequencyPolicy;
use serde_json::Value;
use tokio::sync::{mpsc, oneshot};
use tracing::info;

use crate::{App, RunningApp};

pub struct FreqHopperApp {
    status_tx: mpsc::UnboundedSender<PocsagTxStatus>,
}

impl FreqHopperApp {
    pub fn new() -> (Self, mpsc::UnboundedReceiver<PocsagTxStatus>) {
        let (tx, rx) = mpsc::unbounded_channel();
        (Self { status_tx: tx }, rx)
    }
}

impl App for FreqHopperApp {
    fn metadata() -> AppMetadata
    where
        Self: Sized,
    {
        AppMetadata {
            id: AppId::FreqHopper,
            name: "Freq Hopper".to_string(),
            direction: Direction::Tx,
            regulatory_class: RegulatoryClass::IndoorTestOnly,
        }
    }

    fn start(&self, params: Value) -> Result<RunningApp> {
        let freqs: Vec<f64> = params
            .get("frequencies_hz")
            .and_then(|v| v.as_array())
            .map(|arr| arr.iter().filter_map(|x| x.as_f64()).collect())
            .unwrap_or_default();

        // Validate all frequencies against the policy
        for &freq_hz in &freqs {
            FrequencyPolicy::check("freq_hopper", freq_hz)
                .map_err(|e| anyhow::anyhow!(e))?;
        }

        let status_tx = self.status_tx.clone();
        let (stop_tx, _stop_rx) = oneshot::channel::<()>();

        let join = tokio::task::spawn_blocking(move || {
            run_freq_hopper(freqs, status_tx);
        });

        Ok(RunningApp { stop: stop_tx, join })
    }
}

fn run_freq_hopper(freqs: Vec<f64>, status_tx: mpsc::UnboundedSender<PocsagTxStatus>) {
    let send = |s: PocsagTxStatus| {
        let _ = status_tx.send(s);
    };

    send(PocsagTxStatus::Transmitting { progress_pct: 0 });

    let freq_list: Vec<String> = freqs
        .iter()
        .map(|f| format!("{:.3} MHz", f / 1e6))
        .collect();
    info!("freq_hopper: hopping across [{}]", freq_list.join(", "));

    send(PocsagTxStatus::Transmitting { progress_pct: 50 });
    // TODO(v0.3): hop sequence + tone generation + HackRF sink integration
    send(PocsagTxStatus::Complete);
}
