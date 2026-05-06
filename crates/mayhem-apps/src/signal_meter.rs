use anyhow::Result;
use mayhem_ipc::{AppId, AppMetadata, Direction, RegulatoryClass, SpectrumFrame};
use tokio::sync::{mpsc, oneshot};
use crate::{App, RunningApp};

pub struct SignalMeterApp {
    pub spectrum_tx: mpsc::UnboundedSender<SpectrumFrame>,
}

impl SignalMeterApp {
    pub fn new() -> (Self, mpsc::UnboundedReceiver<SpectrumFrame>) {
        let (tx, rx) = mpsc::unbounded_channel();
        (Self { spectrum_tx: tx }, rx)
    }
}

impl App for SignalMeterApp {
    fn metadata() -> AppMetadata
    where
        Self: Sized,
    {
        AppMetadata {
            id: AppId::SignalMeter,
            name: "Signal Meter".to_string(),
            direction: Direction::Rx,
            regulatory_class: RegulatoryClass::Passive,
        }
    }

    fn start(&self, params: serde_json::Value) -> Result<RunningApp> {
        let (stop_tx, stop_rx) = oneshot::channel::<()>();
        let join = tokio::task::spawn_blocking(move || {
            let _ = (params, stop_rx);
        });
        Ok(RunningApp { stop: stop_tx, join })
    }
}
