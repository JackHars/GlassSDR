//! EPIRB (Emergency Position Indicating Radio Beacon) receiver app.
//! Pipeline: HackRF @ 406 MHz → FM demod → bit slicer → EPIRB decode → emit EpirbBeaconEvent

use anyhow::Result;
use mayhem_ipc::{AppId, AppMetadata, Direction, EpirbBeaconEvent, RegulatoryClass, SpectrumFrame};
use tokio::sync::{mpsc, oneshot};

use crate::{App, RunningApp};

pub struct EpirbRxApp {
    pub event_tx: mpsc::UnboundedSender<EpirbBeaconEvent>,
    pub spectrum_tx: mpsc::UnboundedSender<SpectrumFrame>,
}

impl EpirbRxApp {
    pub fn new() -> (
        Self,
        mpsc::UnboundedReceiver<EpirbBeaconEvent>,
        mpsc::UnboundedReceiver<SpectrumFrame>,
    ) {
        let (e_tx, e_rx) = mpsc::unbounded_channel();
        let (s_tx, s_rx) = mpsc::unbounded_channel();
        (
            Self {
                event_tx: e_tx,
                spectrum_tx: s_tx,
            },
            e_rx,
            s_rx,
        )
    }
}

impl App for EpirbRxApp {
    fn metadata() -> AppMetadata
    where
        Self: Sized,
    {
        AppMetadata {
            id: AppId::EpirbRx,
            name: "EPIRB Receiver".to_string(),
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
