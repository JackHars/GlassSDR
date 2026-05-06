//! OOK Decoders app. Identifies and decodes common OOK protocols (remotes, sensors).

use anyhow::Result;
use mayhem_ipc::{AppId, AppMetadata, Direction, OokDecodeEvent, RegulatoryClass, SpectrumFrame};
use tokio::sync::{mpsc, oneshot};

use crate::{App, RunningApp};

pub struct OokDecodersApp {
    pub event_tx: mpsc::UnboundedSender<OokDecodeEvent>,
    pub spectrum_tx: mpsc::UnboundedSender<SpectrumFrame>,
}

impl OokDecodersApp {
    pub fn new() -> (
        Self,
        mpsc::UnboundedReceiver<OokDecodeEvent>,
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

impl App for OokDecodersApp {
    fn metadata() -> AppMetadata
    where
        Self: Sized,
    {
        AppMetadata {
            id: AppId::OokDecoders,
            name: "OOK Decoders".to_string(),
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
