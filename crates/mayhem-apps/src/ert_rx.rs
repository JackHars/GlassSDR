//! ERT (Encoder Receiver Transmitter) meter receiver app.
//! Pipeline: HackRF @ 912 MHz → Manchester demod → ERT protocol decode → emit

use anyhow::Result;
use mayhem_ipc::{AppId, AppMetadata, Direction, ErtMeterEvent, RegulatoryClass, SpectrumFrame};
use tokio::sync::{mpsc, oneshot};

use crate::{App, RunningApp};

pub struct ErtRxApp {
    pub event_tx: mpsc::UnboundedSender<ErtMeterEvent>,
    pub spectrum_tx: mpsc::UnboundedSender<SpectrumFrame>,
}

impl ErtRxApp {
    pub fn new() -> (
        Self,
        mpsc::UnboundedReceiver<ErtMeterEvent>,
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

impl App for ErtRxApp {
    fn metadata() -> AppMetadata
    where
        Self: Sized,
    {
        AppMetadata {
            id: AppId::ErtRx,
            name: "ERT Meter RX".to_string(),
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
