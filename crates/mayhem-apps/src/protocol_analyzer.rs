//! Protocol Analyzer app. Captures IQ, demodulates, and displays eye diagram.

use anyhow::Result;
use mayhem_ipc::{AppId, AppMetadata, Direction, RegulatoryClass, SpectrumFrame};
use serde_json::Value;
use tokio::sync::{mpsc, oneshot};
use tracing::info;

use crate::{App, RunningApp};

pub struct ProtocolAnalyzerApp {
    spec_tx: mpsc::UnboundedSender<SpectrumFrame>,
}

impl ProtocolAnalyzerApp {
    pub fn new() -> (Self, mpsc::UnboundedReceiver<SpectrumFrame>) {
        let (tx, rx) = mpsc::unbounded_channel();
        (Self { spec_tx: tx }, rx)
    }
}

impl App for ProtocolAnalyzerApp {
    fn metadata() -> AppMetadata
    where
        Self: Sized,
    {
        AppMetadata {
            id: AppId::ProtocolAnalyzer,
            name: "Protocol Analyzer".to_string(),
            direction: Direction::Rx,
            regulatory_class: RegulatoryClass::Passive,
        }
    }

    fn start(&self, params: Value) -> Result<RunningApp> {
        let center_hz = params
            .get("center_hz")
            .and_then(|v| v.as_f64())
            .unwrap_or(433_920_000.0);

        let symbol_rate = params
            .get("symbol_rate")
            .and_then(|v| v.as_f64())
            .unwrap_or(9600.0);

        let spec_tx = self.spec_tx.clone();
        let (stop_tx, mut stop_rx) = oneshot::channel::<()>();

        let join = tokio::task::spawn_blocking(move || {
            info!(center_hz, symbol_rate, "protocol_analyzer: started (stub)");
            // TODO(v0.3): wire HackRF source → eye diagram → SpectrumFrame events.
            let _ = stop_rx.try_recv();
            let _ = spec_tx.send(SpectrumFrame {
                seq: 0,
                bins: vec![0u8; 256],
                center_hz,
                span_hz: 2_000_000.0,
            });
        });

        Ok(RunningApp { stop: stop_tx, join })
    }
}
