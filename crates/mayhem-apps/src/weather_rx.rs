//! Weather station receiver app.
//! Pipeline: HackRF @ 433 MHz → FSK slicer → OOK/FSK decode → weather protocol parse → emit

use anyhow::Result;
use mayhem_ipc::{AppId, AppMetadata, Direction, RegulatoryClass, SpectrumFrame, WeatherEvent};
use tokio::sync::{mpsc, oneshot};

use crate::{App, RunningApp};

pub struct WeatherRxApp {
    pub event_tx: mpsc::UnboundedSender<WeatherEvent>,
    pub spectrum_tx: mpsc::UnboundedSender<SpectrumFrame>,
}

impl WeatherRxApp {
    pub fn new() -> (
        Self,
        mpsc::UnboundedReceiver<WeatherEvent>,
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

impl App for WeatherRxApp {
    fn metadata() -> AppMetadata
    where
        Self: Sized,
    {
        AppMetadata {
            id: AppId::WeatherRx,
            name: "Weather Station RX".to_string(),
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
