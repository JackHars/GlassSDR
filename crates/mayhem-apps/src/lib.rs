//! Apps live here. Each app implements the App trait and registers with AppRegistry.

pub mod adsb_rx;
pub mod nfm_audio;
pub mod registry;

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
