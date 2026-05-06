//! Shared IPC types between Rust backend and TypeScript frontend.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS, PartialEq, Eq, Hash)]
#[ts(export, export_to = "../../../frontend/src/ipc/types/")]
#[serde(rename_all = "snake_case")]
pub enum AppId {
    NfmAudio,
    AdsbRx,
    PocsagTx,
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
    pub seq: u32,
    /// log-magnitude, 0..255, length == fft_size
    pub bins: Vec<u8>,
    pub center_hz: f64,
    pub span_hz: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../frontend/src/ipc/types/")]
pub struct AudioFrame {
    pub seq: u32,
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

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../frontend/src/ipc/types/")]
pub struct AdsbPosition {
    pub lat: f64,
    pub lon: f64,
    pub altitude_ft: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../frontend/src/ipc/types/")]
pub struct AdsbVelocity {
    pub ground_speed_kt: f64,
    pub heading_deg: f64,
    pub vert_rate_fpm: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../frontend/src/ipc/types/")]
pub struct AircraftState {
    /// 6-char hex ICAO24 address (e.g. "4840D6")
    pub icao24: String,
    pub callsign: Option<String>,
    pub position: Option<AdsbPosition>,
    pub velocity: Option<AdsbVelocity>,
    /// Unix milliseconds since epoch. f64 (not u64) so ts-rs maps to `number`
    /// and not `bigint` — same fix as Plan 1's u32 seq fields. f64 has 53 bits
    /// of integer precision; sufficient until year ~287000.
    pub last_seen_ms: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../frontend/src/ipc/types/")]
pub struct PocsagTxParams {
    pub ric: u32,
    pub function: u8,
    pub message: String,
    pub message_type: PocsagMessageType,
    pub baud_rate: u16,
    pub center_hz: f64,
    pub vga_gain_db: u32,
    pub amp_enabled: bool,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS, PartialEq, Eq)]
#[ts(export, export_to = "../../../frontend/src/ipc/types/")]
#[serde(rename_all = "snake_case")]
pub enum PocsagMessageType {
    Numeric,
    Alphanumeric,
    ToneOnly,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../frontend/src/ipc/types/")]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum PocsagTxStatus {
    Idle,
    Armed,
    Transmitting { progress_pct: u8 },
    Complete,
    Error { message: String },
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
    fn pocsag_tx_params_round_trip() {
        let p = PocsagTxParams {
            ric: 1234567,
            function: 0,
            message: "TEST".to_string(),
            message_type: PocsagMessageType::Alphanumeric,
            baud_rate: 1200,
            center_hz: 439_987_500.0,
            vga_gain_db: 30,
            amp_enabled: false,
        };
        let s = serde_json::to_string(&p).unwrap();
        let back: PocsagTxParams = serde_json::from_str(&s).unwrap();
        assert_eq!(back.ric, 1234567);
        assert_eq!(back.message_type, PocsagMessageType::Alphanumeric);
    }

    #[test]
    fn pocsag_tx_status_tags() {
        let s = serde_json::to_string(&PocsagTxStatus::Complete).unwrap();
        assert_eq!(s, r#"{"kind":"complete"}"#);
        let s = serde_json::to_string(&PocsagTxStatus::Transmitting { progress_pct: 50 }).unwrap();
        assert!(s.contains("\"progress_pct\":50"));
    }

    #[test]
    fn app_status_tag_renames() {
        let s = serde_json::to_string(&AppStatus::Idle).unwrap();
        assert_eq!(s, r#"{"kind":"idle"}"#);
        let s = serde_json::to_string(&AppStatus::Running { app: AppId::NfmAudio }).unwrap();
        assert_eq!(s, r#"{"kind":"running","app":"nfm_audio"}"#);
    }
}
