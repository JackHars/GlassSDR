//! Signal Generator app. Transmits a configurable waveform (IndoorTestOnly).

use anyhow::Result;
use mayhem_ipc::{AppId, AppMetadata, Direction, PocsagTxStatus, RegulatoryClass};
use tokio::sync::{mpsc, oneshot};

use crate::{App, RunningApp};

pub struct SigGenApp {
    pub status_tx: mpsc::UnboundedSender<PocsagTxStatus>,
}

impl SigGenApp {
    pub fn new() -> (Self, mpsc::UnboundedReceiver<PocsagTxStatus>) {
        let (tx, rx) = mpsc::unbounded_channel();
        (Self { status_tx: tx }, rx)
    }
}

impl App for SigGenApp {
    fn metadata() -> AppMetadata
    where
        Self: Sized,
    {
        AppMetadata {
            id: AppId::SigGen,
            name: "Signal Generator".to_string(),
            direction: Direction::Tx,
            regulatory_class: RegulatoryClass::IndoorTestOnly,
        }
    }

    fn start(&self, params: serde_json::Value) -> Result<RunningApp> {
        let (stop_tx, stop_rx) = oneshot::channel::<()>();
        let join = tokio::task::spawn_blocking(move || {
            let _ = (params, stop_rx);
        });
        Ok(RunningApp {
            stop: stop_tx,
            join,
        })
    }
}
