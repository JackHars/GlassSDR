//! Decoder Suite app. Multi-protocol OOK receiver.
//!
//! Passive — listens and decodes common OOK remote / sensor protocols.

use anyhow::Result;
use mayhem_ipc::{AppId, AppMetadata, Direction, OokDecodeEvent, RegulatoryClass};
use serde_json::Value;
use tokio::sync::{mpsc, oneshot};

use crate::{App, RunningApp};

pub struct DecoderSuiteApp {
    event_tx: mpsc::UnboundedSender<OokDecodeEvent>,
}

impl DecoderSuiteApp {
    pub fn new() -> (Self, mpsc::UnboundedReceiver<OokDecodeEvent>) {
        let (tx, rx) = mpsc::unbounded_channel();
        (Self { event_tx: tx }, rx)
    }
}

impl App for DecoderSuiteApp {
    fn metadata() -> AppMetadata
    where
        Self: Sized,
    {
        AppMetadata {
            id: AppId::DecoderSuite,
            name: "Decoder Suite".to_string(),
            direction: Direction::Rx,
            regulatory_class: RegulatoryClass::Passive,
        }
    }

    fn start(&self, params: Value) -> Result<RunningApp> {
        let freq_hz = params
            .get("center_hz")
            .and_then(|v| v.as_f64())
            .unwrap_or(433_920_000.0);

        let event_tx = self.event_tx.clone();
        let (stop_tx, stop_rx) = oneshot::channel::<()>();

        let join = tokio::task::spawn_blocking(move || {
            run_decoder_suite(freq_hz, event_tx, stop_rx);
        });

        Ok(RunningApp { stop: stop_tx, join })
    }
}

fn run_decoder_suite(
    freq_hz: f64,
    event_tx: mpsc::UnboundedSender<OokDecodeEvent>,
    mut stop_rx: oneshot::Receiver<()>,
) {
    tracing::info!(freq_hz, "decoder_suite: started (stub)");
    // TODO(v0.3): HackRF source → OOK envelope → multi-protocol decoder chain.
    let _ = stop_rx.try_recv();
    let _ = event_tx;
}
