//! FLEX pager receiver app.
//! Pipeline: HackRF → FM demod → FSK slicer → FLEX protocol decode → emit pages

use anyhow::Result;
use mayhem_ipc::{AppId, AppMetadata, Direction, FlexPageEvent, RegulatoryClass, SpectrumFrame};
use tokio::sync::{mpsc, oneshot};

use crate::{App, RunningApp};

pub struct FlexRxApp {
    pub event_tx: mpsc::UnboundedSender<FlexPageEvent>,
    pub spectrum_tx: mpsc::UnboundedSender<SpectrumFrame>,
}

impl FlexRxApp {
    pub fn new() -> (
        Self,
        mpsc::UnboundedReceiver<FlexPageEvent>,
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

impl App for FlexRxApp {
    fn metadata() -> AppMetadata
    where
        Self: Sized,
    {
        AppMetadata {
            id: AppId::FlexRx,
            name: "FLEX Pager RX".to_string(),
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
