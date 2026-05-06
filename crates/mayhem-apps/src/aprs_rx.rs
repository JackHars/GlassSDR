//! APRS receiver app. Pipeline:
//!   HackRF @ 144.39 MHz → FM demod → AFSK Bell 202 → NRZI → HDLC → AX.25 → APRS parse → emit

use anyhow::Result;
use mayhem_ipc::{AppId, AppMetadata, AprsPacketEvent, Direction, RegulatoryClass, SpectrumFrame};
use tokio::sync::{mpsc, oneshot};

use crate::{App, RunningApp};

pub struct AprsRxApp {
    pub event_tx: mpsc::UnboundedSender<AprsPacketEvent>,
    pub spectrum_tx: mpsc::UnboundedSender<SpectrumFrame>,
}

impl AprsRxApp {
    pub fn new() -> (
        Self,
        mpsc::UnboundedReceiver<AprsPacketEvent>,
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

impl App for AprsRxApp {
    fn metadata() -> AppMetadata
    where
        Self: Sized,
    {
        AppMetadata {
            id: AppId::AprsRx,
            name: "APRS Receiver".to_string(),
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
