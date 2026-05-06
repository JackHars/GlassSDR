//! Remote Control app. WebSocket gateway for controlling Mayhem over the network.
//! No radio required — purely a network stub.

use anyhow::Result;
use mayhem_ipc::{AppId, AppMetadata, Direction, RegulatoryClass, SpectrumFrame};
use serde_json::Value;
use tokio::sync::{mpsc, oneshot};
use tracing::info;

use crate::{App, RunningApp};

pub struct RemoteControlApp {
    spec_tx: mpsc::UnboundedSender<SpectrumFrame>,
}

impl RemoteControlApp {
    pub fn new() -> (Self, mpsc::UnboundedReceiver<SpectrumFrame>) {
        let (tx, rx) = mpsc::unbounded_channel();
        (Self { spec_tx: tx }, rx)
    }
}

impl App for RemoteControlApp {
    fn metadata() -> AppMetadata
    where
        Self: Sized,
    {
        AppMetadata {
            id: AppId::RemoteControl,
            name: "Remote Control".to_string(),
            direction: Direction::Rx,
            regulatory_class: RegulatoryClass::Passive,
        }
    }

    fn start(&self, params: Value) -> Result<RunningApp> {
        let port = params
            .get("port")
            .and_then(|v| v.as_u64())
            .unwrap_or(9090) as u16;

        let _spec_tx = self.spec_tx.clone();
        let (stop_tx, mut stop_rx) = oneshot::channel::<()>();

        let join = tokio::task::spawn_blocking(move || {
            info!(port, "remote_control: WebSocket server stub started");
            // TODO(v0.3): bind tokio-tungstenite WebSocket listener on `port`.
            let _ = stop_rx.try_recv();
        });

        Ok(RunningApp { stop: stop_tx, join })
    }
}
