//! Frequency Counter app. High-precision frequency measurement via zero-crossing.

use anyhow::Result;
use mayhem_ipc::{AppId, AppMetadata, Direction, FreqMeasureEvent, RegulatoryClass};
use serde_json::Value;
use tokio::sync::{mpsc, oneshot};
use tracing::info;

use crate::{App, RunningApp};

pub struct FreqCounterApp {
    event_tx: mpsc::UnboundedSender<FreqMeasureEvent>,
}

impl FreqCounterApp {
    pub fn new() -> (Self, mpsc::UnboundedReceiver<FreqMeasureEvent>) {
        let (tx, rx) = mpsc::unbounded_channel();
        (Self { event_tx: tx }, rx)
    }
}

impl App for FreqCounterApp {
    fn metadata() -> AppMetadata
    where
        Self: Sized,
    {
        AppMetadata {
            id: AppId::FreqCounter,
            name: "Frequency Counter".to_string(),
            direction: Direction::Rx,
            regulatory_class: RegulatoryClass::Passive,
        }
    }

    fn start(&self, params: Value) -> Result<RunningApp> {
        let center_hz = params
            .get("center_hz")
            .and_then(|v| v.as_f64())
            .unwrap_or(100_000_000.0);

        let gate_ms = params
            .get("gate_ms")
            .and_then(|v| v.as_u64())
            .unwrap_or(1000);

        let event_tx = self.event_tx.clone();
        let (stop_tx, mut stop_rx) = oneshot::channel::<()>();

        let join = tokio::task::spawn_blocking(move || {
            info!(center_hz, gate_ms, "freq_counter: started (stub)");
            // TODO(v0.3): HackRF source → zero-crossing counter → FreqMeasureEvent.
            let _ = stop_rx.try_recv();
            let _ = event_tx.send(FreqMeasureEvent {
                frequency_hz: center_hz,
                precision_hz: 1.0,
            });
        });

        Ok(RunningApp { stop: stop_tx, join })
    }
}
