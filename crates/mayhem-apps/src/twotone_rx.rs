//! Two-Tone pager receiver app.
//! Pipeline: HackRF @ VHF → FM demod → tone detect → two-tone sequence decode → emit

use anyhow::Result;
use mayhem_ipc::{AppId, AppMetadata, Direction, RegulatoryClass, SpectrumFrame, TwoToneEvent};
use tokio::sync::{mpsc, oneshot};

use crate::{App, RunningApp};

pub struct TwoToneRxApp {
    pub event_tx: mpsc::UnboundedSender<TwoToneEvent>,
    pub spectrum_tx: mpsc::UnboundedSender<SpectrumFrame>,
}

impl TwoToneRxApp {
    pub fn new() -> (
        Self,
        mpsc::UnboundedReceiver<TwoToneEvent>,
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

impl App for TwoToneRxApp {
    fn metadata() -> AppMetadata
    where
        Self: Sized,
    {
        AppMetadata {
            id: AppId::TwoToneRx,
            name: "Two-Tone Pager RX".to_string(),
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
