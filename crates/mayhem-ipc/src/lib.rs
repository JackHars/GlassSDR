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
    WfmRx,
    AmRx,
    UsbRx,
    LsbRx,
    CwRx,
    RdsRx,
    AprsRx,
    AisRx,
    AcarsRx,
    PocsagRx,
    AfskRx,
    ErtRx,
    WeatherRx,
    SondeRx,
    TwoToneRx,
    FlexRx,
    TpmsRx,
    OokAnalyzer,
    Scanner,
    Recon,
    LookingGlass,
    SigGen,
    OokDecoders,
    SubGhzCapture,
    AptRx,
    DscRx,
    EpirbRx,
    SondeRxExt,
    DabRx,
    HrptRx,
    LrptRx,
    AdsbRxExt,
    RttyTx,
    SstvTx,
    AfskTx,
    MorseTx,
    SoundboardTx,
    FlexTx,
    AdsbTx,
    GpsSim,
    Mdc1200Tx,
    ReplayTx,
    OokEditorTx,
    FreqHopper,
    BtleTx,
    Nrf24Tx,
    Rfm69Tx,
    FlipperTx,
    KeyfobTx,
    LgeTx,
    FreqManager,
    FileManager,
    Playlist,
    Settings,
    Calculator,
    Notepad,
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

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../frontend/src/ipc/types/")]
pub struct WfmTuning {
    pub center_hz: f64,
    pub lna_gain_db: u32,
    pub vga_gain_db: u32,
    pub amp_enabled: bool,
    pub stereo: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../frontend/src/ipc/types/")]
pub struct AmTuning {
    pub center_hz: f64,
    pub lna_gain_db: u32,
    pub vga_gain_db: u32,
    pub amp_enabled: bool,
    pub bandwidth_hz: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../frontend/src/ipc/types/")]
pub struct SsbTuning {
    pub center_hz: f64,
    pub lna_gain_db: u32,
    pub vga_gain_db: u32,
    pub amp_enabled: bool,
    pub bfo_hz: f32,
    pub bandwidth_hz: f32,
    pub sideband: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../frontend/src/ipc/types/")]
pub struct RdsData {
    pub pi: u16,
    pub ps: String,
    pub rt: String,
    pub pty: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../frontend/src/ipc/types/")]
pub struct AprsPacketEvent {
    pub src: String,
    pub dst: String,
    pub payload_type: String,
    pub lat: Option<f64>,
    pub lon: Option<f64>,
    pub comment: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../frontend/src/ipc/types/")]
pub struct AisShipEvent {
    pub mmsi: u32,
    pub name: Option<String>,
    pub lat: f64,
    pub lon: f64,
    pub speed_kt: f64,
    pub course: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../frontend/src/ipc/types/")]
pub struct AcarsMessageEvent {
    pub reg: String,
    pub flight: String,
    pub label: String,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../frontend/src/ipc/types/")]
pub struct PocsagPageEvent {
    pub ric: u32,
    pub function: u8,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../frontend/src/ipc/types/")]
pub struct AfskBitEvent {
    pub hex_dump: String,
    pub decoded_ascii: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../frontend/src/ipc/types/")]
pub struct ErtMeterEvent {
    pub meter_id: u32,
    pub meter_type: String,
    pub consumption: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../frontend/src/ipc/types/")]
pub struct WeatherEvent {
    pub sensor_id: u16,
    pub channel: u8,
    pub temp_c: Option<f32>,
    pub humidity: Option<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../frontend/src/ipc/types/")]
pub struct SondeEvent {
    pub serial: String,
    pub lat: f64,
    pub lon: f64,
    pub alt_m: f64,
    pub sonde_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../frontend/src/ipc/types/")]
pub struct TwoToneEvent {
    pub tone_a_hz: f32,
    pub tone_b_hz: f32,
    pub timestamp_ms: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../frontend/src/ipc/types/")]
pub struct FlexPageEvent {
    pub capcode: u32,
    pub message: String,
    pub cycle: u8,
    pub frame: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../frontend/src/ipc/types/")]
pub struct ScanResultEvent {
    pub freq_hz: f64,
    pub power_db: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../frontend/src/ipc/types/")]
pub struct PulseEventIpc {
    pub is_high: bool,
    pub duration_us: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../frontend/src/ipc/types/")]
pub struct OokDecodeEvent {
    pub protocol: String,
    pub code_hex: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../frontend/src/ipc/types/")]
pub struct TpmsSensorEvent {
    pub sensor_id: u32,
    pub pressure_kpa: f32,
    pub temp_c: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../frontend/src/ipc/types/")]
pub struct AptLineEvent {
    pub line_number: u32,
    pub channel: String,
    pub pixels_len: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../frontend/src/ipc/types/")]
pub struct DscMessageEvent {
    pub mmsi: u32,
    pub category: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../frontend/src/ipc/types/")]
pub struct EpirbBeaconEvent {
    pub hex_id: String,
    pub country_code: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../frontend/src/ipc/types/")]
pub struct DabServiceEvent {
    pub eid: u16,
    pub ensemble_label: String,
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
