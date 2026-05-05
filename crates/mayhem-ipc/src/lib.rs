//! Shared IPC types between Rust backend and TypeScript frontend.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS, PartialEq, Eq, Hash)]
#[ts(export, export_to = "../../../frontend/src/ipc/types/")]
#[serde(rename_all = "snake_case")]
pub enum AppId {
    NfmAudio,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS, PartialEq, Eq)]
#[ts(export, export_to = "../../../frontend/src/ipc/types/")]
#[serde(rename_all = "snake_case")]
pub enum Direction {
    Rx,
    Tx,
    Both,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS, PartialEq, Eq)]
#[ts(export, export_to = "../../../frontend/src/ipc/types/")]
#[serde(rename_all = "snake_case")]
pub enum RegulatoryClass {
    Passive,
    AmateurOnly,
    OwnDevicesOnly,
    IndoorTestOnly,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../frontend/src/ipc/types/")]
pub struct AppMetadata {
    pub id: AppId,
    pub name: String,
    pub direction: Direction,
    pub regulatory_class: RegulatoryClass,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../frontend/src/ipc/types/")]
pub struct SpectrumFrame {
    pub seq: u64,
    /// log-magnitude, 0..255, length == fft_size
    pub bins: Vec<u8>,
    pub center_hz: f64,
    pub span_hz: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../frontend/src/ipc/types/")]
pub struct AudioFrame {
    pub seq: u64,
    /// int16 PCM, 48 kHz, mono. 20 ms = 960 samples.
    pub samples: Vec<i16>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../frontend/src/ipc/types/")]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum AppStatus {
    Idle,
    Starting { app: AppId },
    Running { app: AppId },
    Stopping,
    Error { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../frontend/src/ipc/types/")]
pub struct NfmTuning {
    pub center_hz: f64,
    pub lna_gain_db: u32,
    pub vga_gain_db: u32,
    pub amp_enabled: bool,
    pub squelch_db: f32,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn metadata_round_trip() {
        let m = AppMetadata {
            id: AppId::NfmAudio,
            name: "NFM Audio".to_string(),
            direction: Direction::Rx,
            regulatory_class: RegulatoryClass::Passive,
        };
        let s = serde_json::to_string(&m).unwrap();
        let back: AppMetadata = serde_json::from_str(&s).unwrap();
        assert_eq!(back.name, "NFM Audio");
        assert!(matches!(back.id, AppId::NfmAudio));
    }

    #[test]
    fn app_status_tag_renames() {
        let s = serde_json::to_string(&AppStatus::Idle).unwrap();
        assert_eq!(s, r#"{"kind":"idle"}"#);
        let s = serde_json::to_string(&AppStatus::Running { app: AppId::NfmAudio }).unwrap();
        assert_eq!(s, r#"{"kind":"running","app":"nfm_audio"}"#);
    }
}
