//! Looking Glass app. Continuous full-band spectrum display.

use anyhow::Result;
use mayhem_ipc::{AppId, AppMetadata, Direction, RegulatoryClass, ScanResultEvent, SpectrumFrame};
use tokio::sync::{mpsc, oneshot};

use crate::{App, RunningApp};

pub struct LookingGlassApp {
    pub event_tx: mpsc::UnboundedSender<ScanResultEvent>,
    pub spectrum_tx: mpsc::UnboundedSender<SpectrumFrame>,
}

impl LookingGlassApp {
    pub fn new() -> (
        Self,
        mpsc::UnboundedReceiver<ScanResultEvent>,
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

impl App for LookingGlassApp {
    fn metadata() -> AppMetadata
    where
        Self: Sized,
    {
        AppMetadata {
            id: AppId::LookingGlass,
            name: "Looking Glass".to_string(),
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
