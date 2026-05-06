//! SDR Benchmark app. Measures HackRF throughput, latency, and sample loss.

use anyhow::Result;
use mayhem_ipc::{AppId, AppMetadata, Direction, RegulatoryClass, SpectrumFrame};
use serde_json::Value;
use tokio::sync::{mpsc, oneshot};
use tracing::info;

use crate::{App, RunningApp};

pub struct SdrBenchmarkApp {
    spec_tx: mpsc::UnboundedSender<SpectrumFrame>,
}

impl SdrBenchmarkApp {
    pub fn new() -> (Self, mpsc::UnboundedReceiver<SpectrumFrame>) {
        let (tx, rx) = mpsc::unbounded_channel();
        (Self { spec_tx: tx }, rx)
    }
}

impl App for SdrBenchmarkApp {
    fn metadata() -> AppMetadata
    where
        Self: Sized,
    {
        AppMetadata {
            id: AppId::SdrBenchmark,
            name: "SDR Benchmark".to_string(),
            direction: Direction::Rx,
            regulatory_class: RegulatoryClass::Passive,
        }
    }

    fn start(&self, params: Value) -> Result<RunningApp> {
        let duration_s = params
            .get("duration_s")
            .and_then(|v| v.as_u64())
            .unwrap_or(10);

        let center_hz = params
            .get("center_hz")
            .and_then(|v| v.as_f64())
            .unwrap_or(100_000_000.0);

        let spec_tx = self.spec_tx.clone();
        let (stop_tx, mut stop_rx) = oneshot::channel::<()>();

        let join = tokio::task::spawn_blocking(move || {
            info!(duration_s, center_hz, "sdr_benchmark: running (stub)");
            // TODO(v0.3): open HackRF, measure samples/s, lost samples, latency.
            let _ = stop_rx.try_recv();
            let _ = spec_tx.send(SpectrumFrame {
                seq: 0,
                bins: vec![128u8; 256],
                center_hz,
                span_hz: 20_000_000.0,
            });
        });

        Ok(RunningApp { stop: stop_tx, join })
    }
}
