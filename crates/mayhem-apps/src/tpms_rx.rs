//! TPMS Receiver app. Listens on 315 MHz or 433.92 MHz for tire pressure sensors.

use anyhow::Result;
use mayhem_ipc::{AppId, AppMetadata, Direction, RegulatoryClass, SpectrumFrame, TpmsSensorEvent};
use tokio::sync::{mpsc, oneshot};

use crate::{App, RunningApp};

pub struct TpmsRxApp {
    pub event_tx: mpsc::UnboundedSender<TpmsSensorEvent>,
    pub spectrum_tx: mpsc::UnboundedSender<SpectrumFrame>,
}

impl TpmsRxApp {
    pub fn new() -> (
        Self,
        mpsc::UnboundedReceiver<TpmsSensorEvent>,
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

impl App for TpmsRxApp {
    fn metadata() -> AppMetadata
    where
        Self: Sized,
    {
        AppMetadata {
            id: AppId::TpmsRx,
            name: "TPMS Receiver".to_string(),
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
