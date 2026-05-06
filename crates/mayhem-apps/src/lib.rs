//! Apps live here. Each app implements the App trait and registers with AppRegistry.

pub mod acars_rx;
pub mod looking_glass;
pub mod ook_analyzer;
pub mod ook_decoders;
pub mod recon;
pub mod scanner;
pub mod sig_gen_app;
pub mod subghz_capture;
pub mod tpms_rx;
pub mod adsb_rx;
pub mod afsk_rx;
pub mod ais_rx;
pub mod am_rx;
pub mod aprs_rx;
pub mod cw_rx;
pub mod ert_rx;
pub mod flex_rx;
pub mod nfm_audio;
pub mod pocsag_rx;
pub mod pocsag_tx;
pub mod rds_rx;
pub mod registry;
pub mod sonde_rx;
pub mod ssb_rx;
pub mod twotone_rx;
pub mod weather_rx;
pub mod wfm_rx;
pub mod apt_rx;
pub mod dsc_rx;
pub mod epirb_rx;
pub mod sonde_rx_ext;
pub mod dab_rx;
pub mod hrpt_rx;
pub mod lrpt_rx;
pub mod adsb_rx_ext;
pub mod rtty_tx;
pub mod sstv_tx;
pub mod afsk_tx;
pub mod morse_tx;
pub mod soundboard_tx;
pub mod flex_tx;
pub mod adsb_tx;
pub mod gps_sim;
pub mod mdc1200_tx;
pub mod replay_tx;
pub mod ook_editor_tx;
pub mod freq_hopper;
pub mod btle_tx;
pub mod nrf24_tx;
pub mod rfm69_tx;
pub mod flipper_tx;
pub mod keyfob_tx;
pub mod lge_tx;

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
