//! Apps live here. Each app implements the App trait and registers with AppRegistry.

pub mod acars_rx;
pub mod adsb_rx;
pub mod afsk_rx;
pub mod ais_rx;
pub mod am_rx;
pub mod aprs_rx;
pub mod cw_rx;
pub mod nfm_audio;
pub mod pocsag_rx;
pub mod pocsag_tx;
pub mod rds_rx;
pub mod registry;
pub mod ssb_rx;
pub mod wfm_rx;

use anyhow::Result;
use mayhem_ipc::AppMetadata;
use tokio::sync::oneshot;

pub use registry::AppRegistry;

/// A running app holds the flowgraph handle and the cancel signal.
/// Drop it to stop the app gracefully.
pub struct RunningApp {
    pub stop: oneshot::Sender<()>,
    pub join: tokio::task::JoinHandle<()>,
}

pub trait App: Send + Sync {
    fn metadata() -> AppMetadata where Self: Sized;
    fn start(&self, params: serde_json::Value) -> Result<RunningApp>;
}
