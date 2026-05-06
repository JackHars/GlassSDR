//! NOAA HRPT (High Resolution Picture Transmission) receiver app.
//! Pipeline: HackRF @ ~1700 MHz → BPSK demod → HRPT frame parse → emit AptLineEvent

use anyhow::Result;
use mayhem_ipc::{AppId, AppMetadata, AptLineEvent, Direction, RegulatoryClass, SpectrumFrame};
use tokio::sync::{mpsc, oneshot};

use crate::{App, RunningApp};

pub struct HrptRxApp {
    pub event_tx: mpsc::UnboundedSender<AptLineEvent>,
    pub spectrum_tx: mpsc::UnboundedSender<SpectrumFrame>,
}

impl HrptRxApp {
    pub fn new() -> (
        Self,
        mpsc::UnboundedReceiver<AptLineEvent>,
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

impl App for HrptRxApp {
    fn metadata() -> AppMetadata
    where
        Self: Sized,
    {
        AppMetadata {
            id: AppId::HrptRx,
            name: "NOAA HRPT RX".to_string(),
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
