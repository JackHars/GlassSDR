//! ADS-B Extended receiver app — additional DF types and Mode-S decode.
//! Pipeline: HackRF @ 1090 MHz → PPM demod → extended ADS-B decode → emit AircraftState

use anyhow::Result;
use mayhem_ipc::{AircraftState, AppId, AppMetadata, Direction, RegulatoryClass};
use tokio::sync::{mpsc, oneshot};

use crate::{App, RunningApp};

pub struct AdsbRxExtApp {
    pub state_tx: mpsc::UnboundedSender<AircraftState>,
}

impl AdsbRxExtApp {
    pub fn new() -> (Self, mpsc::UnboundedReceiver<AircraftState>) {
        let (tx, rx) = mpsc::unbounded_channel();
        (Self { state_tx: tx }, rx)
    }
}

impl App for AdsbRxExtApp {
    fn metadata() -> AppMetadata
    where
        Self: Sized,
    {
        AppMetadata {
            id: AppId::AdsbRxExt,
            name: "ADS-B Extended".to_string(),
            direction: Direction::Rx,
            regulatory_class: RegulatoryClass::Passive,
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
