//! Shared per-format recorders for GlassSDR apps.
//!
//! Four recorder types — WAV, JSONL, IQ, IMG — each opens a file at construction
//! and writes streaming frames until `finish()` is called. The runtime owns one
//! `ActiveRecording` at a time; pumps in the runner check it before emitting and
//! also write to the recorder.

use anyhow::{anyhow, Result};
use mayhem_ipc::{AppId, AudioFrame};
use serde::{Deserialize, Serialize};
use std::fs::{File, OpenOptions};
use std::io::{BufWriter, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use ts_rs::TS;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS, PartialEq, Eq)]
#[ts(export, export_to = "../../../frontend/src/ipc/types/")]
#[serde(rename_all = "snake_case")]
pub enum RecordingFormat {
    Wav,
    Jsonl,
    Iq,
    Img,
}

impl RecordingFormat {
    pub fn extension(self) -> &'static str {
        match self {
            RecordingFormat::Wav => "wav",
            RecordingFormat::Jsonl => "jsonl",
            RecordingFormat::Iq => "cs8",
            RecordingFormat::Img => "png",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../frontend/src/ipc/types/")]
pub struct RecordingMeta {
    pub id: String,
    pub app_id: AppId,
    pub format: RecordingFormat,
    pub path: String,
    pub started_unix_ms: f64,
    pub duration_ms: f64,
    pub size_bytes: f64,
    /// Optional center frequency tagged at start.
    pub center_hz: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../frontend/src/ipc/types/")]
pub struct RecordingStatus {
    pub id: String,
    pub elapsed_ms: f64,
    pub bytes_written: f64,
}

pub struct ActiveRecording {
    pub id: String,
    pub app_id: AppId,
    pub format: RecordingFormat,
    pub path: PathBuf,
    pub started_at: Instant,
    pub started_unix_ms: f64,
    pub center_hz: Option<f64>,
    bytes_written: u64,
    inner: RecorderInner,
}

enum RecorderInner {
    Wav(WavRecorder),
    Jsonl(JsonlRecorder),
    Iq(IqRecorder),
    Img(ImgRecorder),
}

impl ActiveRecording {
    pub fn new(
        app_id: AppId,
        format: RecordingFormat,
        recordings_root: &Path,
        center_hz: Option<f64>,
    ) -> Result<Self> {
        let app_dir = recordings_root.join(app_id_slug(app_id));
        std::fs::create_dir_all(&app_dir)?;
        let stamp = timestamp_slug();
        let path = app_dir.join(format!("{stamp}.{}", format.extension()));
        let id = format!("{}-{}", app_id_slug(app_id), stamp);

        let inner = match format {
            RecordingFormat::Wav => RecorderInner::Wav(WavRecorder::open(&path)?),
            RecordingFormat::Jsonl => RecorderInner::Jsonl(JsonlRecorder::open(&path)?),
            RecordingFormat::Iq => RecorderInner::Iq(IqRecorder::open(&path, center_hz)?),
            RecordingFormat::Img => RecorderInner::Img(ImgRecorder::open(&app_dir, &stamp)?),
        };

        let started_unix_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as f64)
            .unwrap_or(0.0);

        Ok(Self {
            id,
            app_id,
            format,
            path,
            started_at: Instant::now(),
            started_unix_ms,
            center_hz,
            bytes_written: 0,
            inner,
        })
    }

    pub fn write_audio(&mut self, frame: &AudioFrame) -> Result<()> {
        match &mut self.inner {
            RecorderInner::Wav(w) => {
                let n = w.write_pcm(&frame.samples)?;
                self.bytes_written += n as u64;
                Ok(())
            }
            _ => Ok(()),
        }
    }

    pub fn write_event<T: Serialize>(&mut self, event: &T) -> Result<()> {
        match &mut self.inner {
            RecorderInner::Jsonl(w) => {
                let n = w.write_event(event)?;
                self.bytes_written += n as u64;
                Ok(())
            }
            _ => Ok(()),
        }
    }

    pub fn write_iq(&mut self, samples: &[u8]) -> Result<()> {
        match &mut self.inner {
            RecorderInner::Iq(w) => {
                let n = w.write(samples)?;
                self.bytes_written += n as u64;
                Ok(())
            }
            _ => Ok(()),
        }
    }

    pub fn write_image_png(&mut self, png_bytes: &[u8]) -> Result<()> {
        match &mut self.inner {
            RecorderInner::Img(w) => {
                let n = w.write_png(png_bytes)?;
                self.bytes_written += n as u64;
                Ok(())
            }
            _ => Ok(()),
        }
    }

    pub fn elapsed_ms(&self) -> f64 {
        self.started_at.elapsed().as_millis() as f64
    }

    pub fn bytes_written(&self) -> u64 {
        self.bytes_written
    }

    pub fn finish(mut self) -> Result<RecordingMeta> {
        let elapsed_ms = self.elapsed_ms();
        match &mut self.inner {
            RecorderInner::Wav(w) => w.finalize()?,
            RecorderInner::Jsonl(w) => w.finalize()?,
            RecorderInner::Iq(w) => w.finalize(elapsed_ms / 1000.0)?,
            RecorderInner::Img(w) => w.finalize()?,
        }
        Ok(RecordingMeta {
            id: self.id,
            app_id: self.app_id,
            format: self.format,
            path: self.path.to_string_lossy().to_string(),
            started_unix_ms: self.started_unix_ms,
            duration_ms: elapsed_ms,
            size_bytes: self.bytes_written as f64,
            center_hz: self.center_hz,
        })
    }
}

// ---------- WAV ----------

struct WavRecorder {
    writer: BufWriter<File>,
    samples_written: u32,
}

const WAV_HEADER_BYTES: u32 = 44;

impl WavRecorder {
    fn open(path: &Path) -> Result<Self> {
        let file = OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .open(path)?;
        let mut writer = BufWriter::new(file);
        // Placeholder header — patched on finalize.
        writer.write_all(&[0u8; WAV_HEADER_BYTES as usize])?;
        Ok(Self { writer, samples_written: 0 })
    }

    fn write_pcm(&mut self, samples: &[i16]) -> Result<usize> {
        let mut bytes = Vec::with_capacity(samples.len() * 2);
        for s in samples {
            bytes.extend_from_slice(&s.to_le_bytes());
        }
        self.writer.write_all(&bytes)?;
        self.samples_written += samples.len() as u32;
        Ok(bytes.len())
    }

    fn finalize(&mut self) -> Result<()> {
        self.writer.flush()?;
        let data_bytes = self.samples_written * 2;
        let chunk_size = 36 + data_bytes;
        let header = wav_header(48_000, 1, 16, data_bytes, chunk_size);
        let inner = self.writer.get_mut();
        inner.seek(SeekFrom::Start(0))?;
        inner.write_all(&header)?;
        inner.flush()?;
        Ok(())
    }
}

fn wav_header(sample_rate: u32, channels: u16, bits: u16, data_bytes: u32, chunk_size: u32) -> [u8; 44] {
    let mut h = [0u8; 44];
    h[0..4].copy_from_slice(b"RIFF");
    h[4..8].copy_from_slice(&chunk_size.to_le_bytes());
    h[8..12].copy_from_slice(b"WAVE");
    h[12..16].copy_from_slice(b"fmt ");
    h[16..20].copy_from_slice(&16u32.to_le_bytes()); // fmt chunk size
    h[20..22].copy_from_slice(&1u16.to_le_bytes()); // PCM
    h[22..24].copy_from_slice(&channels.to_le_bytes());
    h[24..28].copy_from_slice(&sample_rate.to_le_bytes());
    let byte_rate = sample_rate * channels as u32 * bits as u32 / 8;
    h[28..32].copy_from_slice(&byte_rate.to_le_bytes());
    let block_align = channels * bits / 8;
    h[32..34].copy_from_slice(&block_align.to_le_bytes());
    h[34..36].copy_from_slice(&bits.to_le_bytes());
    h[36..40].copy_from_slice(b"data");
    h[40..44].copy_from_slice(&data_bytes.to_le_bytes());
    h
}

// ---------- JSONL ----------

struct JsonlRecorder {
    writer: BufWriter<File>,
}

impl JsonlRecorder {
    fn open(path: &Path) -> Result<Self> {
        let file = OpenOptions::new().write(true).create(true).truncate(true).open(path)?;
        Ok(Self { writer: BufWriter::new(file) })
    }

    fn write_event<T: Serialize>(&mut self, event: &T) -> Result<usize> {
        let ts = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0);
        let envelope = serde_json::json!({ "t_ms": ts, "event": event });
        let line = serde_json::to_string(&envelope)?;
        self.writer.write_all(line.as_bytes())?;
        self.writer.write_all(b"\n")?;
        Ok(line.len() + 1)
    }

    fn finalize(&mut self) -> Result<()> {
        self.writer.flush().map_err(Into::into)
    }
}

// ---------- IQ ----------

struct IqRecorder {
    writer: BufWriter<File>,
    sidecar_path: PathBuf,
    center_hz: Option<f64>,
}

impl IqRecorder {
    fn open(path: &Path, center_hz: Option<f64>) -> Result<Self> {
        let file = OpenOptions::new().write(true).create(true).truncate(true).open(path)?;
        let sidecar_path = path.with_extension("json");
        Ok(Self { writer: BufWriter::new(file), sidecar_path, center_hz })
    }

    fn write(&mut self, samples: &[u8]) -> Result<usize> {
        self.writer.write_all(samples)?;
        Ok(samples.len())
    }

    fn finalize(&mut self, duration_s: f64) -> Result<()> {
        self.writer.flush()?;
        let meta = serde_json::json!({
            "format": "cs8",
            "sample_rate_hz": 2_400_000,
            "center_hz": self.center_hz,
            "duration_s": duration_s,
        });
        std::fs::write(&self.sidecar_path, serde_json::to_string_pretty(&meta)?)?;
        Ok(())
    }
}

// ---------- IMG ----------

struct ImgRecorder {
    dir: PathBuf,
    stamp: String,
    image_count: usize,
    index: Vec<PathBuf>,
}

impl ImgRecorder {
    fn open(dir: &Path, stamp: &str) -> Result<Self> {
        Ok(Self {
            dir: dir.to_path_buf(),
            stamp: stamp.to_string(),
            image_count: 0,
            index: Vec::new(),
        })
    }

    fn write_png(&mut self, png_bytes: &[u8]) -> Result<usize> {
        let name = if self.image_count == 0 {
            format!("{}.png", self.stamp)
        } else {
            format!("{}-{:03}.png", self.stamp, self.image_count)
        };
        let path = self.dir.join(&name);
        std::fs::write(&path, png_bytes)?;
        self.image_count += 1;
        self.index.push(path);
        Ok(png_bytes.len())
    }

    fn finalize(&mut self) -> Result<()> {
        if self.index.is_empty() {
            return Ok(());
        }
        let sidecar = self.dir.join(format!("{}.json", self.stamp));
        let entries: Vec<String> = self.index.iter().map(|p| p.to_string_lossy().to_string()).collect();
        let meta = serde_json::json!({ "images": entries });
        std::fs::write(&sidecar, serde_json::to_string_pretty(&meta)?)?;
        Ok(())
    }
}

// ---------- Helpers ----------

fn timestamp_slug() -> String {
    let now = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    // Format yyyymmdd-hhmmss without external time crate.
    let secs = now as i64;
    let (y, mo, d, h, mi, se) = epoch_to_ymdhms(secs);
    format!("{:04}{:02}{:02}-{:02}{:02}{:02}", y, mo, d, h, mi, se)
}

fn epoch_to_ymdhms(secs: i64) -> (i32, u32, u32, u32, u32, u32) {
    let days = secs / 86400;
    let rem = secs.rem_euclid(86400);
    let h = (rem / 3600) as u32;
    let mi = ((rem % 3600) / 60) as u32;
    let se = (rem % 60) as u32;
    let (y, mo, d) = days_to_ymd(days);
    (y, mo, d, h, mi, se)
}

fn days_to_ymd(days_since_epoch: i64) -> (i32, u32, u32) {
    // Howard Hinnant's date algorithm — handles 1970+ correctly.
    let z = days_since_epoch + 719468;
    let era = if z >= 0 { z / 146097 } else { (z - 146096) / 146097 };
    let doe = (z - era * 146097) as u32;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe as i32 + era as i32 * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    (y, m, d)
}

fn app_id_slug(app: AppId) -> &'static str {
    use AppId::*;
    match app {
        NfmAudio => "nfm_audio",
        AdsbRx => "adsb_rx",
        PocsagTx => "pocsag_tx",
        WfmRx => "wfm_rx",
        AmRx => "am_rx",
        UsbRx => "usb_rx",
        LsbRx => "lsb_rx",
        CwRx => "cw_rx",
        RdsRx => "rds_rx",
        AprsRx => "aprs_rx",
        AisRx => "ais_rx",
        AcarsRx => "acars_rx",
        PocsagRx => "pocsag_rx",
        AfskRx => "afsk_rx",
        ErtRx => "ert_rx",
        WeatherRx => "weather_rx",
        SondeRx => "sonde_rx",
        TwoToneRx => "two_tone_rx",
        FlexRx => "flex_rx",
        TpmsRx => "tpms_rx",
        OokAnalyzer => "ook_analyzer",
        Scanner => "scanner",
        Recon => "recon",
        LookingGlass => "looking_glass",
        SigGen => "sig_gen",
        OokDecoders => "ook_decoders",
        SubGhzCapture => "sub_ghz_capture",
        AptRx => "apt_rx",
        DscRx => "dsc_rx",
        EpirbRx => "epirb_rx",
        SondeRxExt => "sonde_rx_ext",
        DabRx => "dab_rx",
        HrptRx => "hrpt_rx",
        LrptRx => "lrpt_rx",
        AdsbRxExt => "adsb_rx_ext",
        RttyTx => "rtty_tx",
        SstvTx => "sstv_tx",
        AfskTx => "afsk_tx",
        MorseTx => "morse_tx",
        SoundboardTx => "soundboard_tx",
        FlexTx => "flex_tx",
        AdsbTx => "adsb_tx",
        GpsSim => "gps_sim",
        Mdc1200Tx => "mdc1200_tx",
        ReplayTx => "replay_tx",
        OokEditorTx => "ook_editor_tx",
        FreqHopper => "freq_hopper",
        BtleTx => "btle_tx",
        Nrf24Tx => "nrf24_tx",
        Rfm69Tx => "rfm69_tx",
        FlipperTx => "flipper_tx",
        KeyfobTx => "keyfob_tx",
        LgeTx => "lge_tx",
        FreqManager => "freq_manager",
        Playlist => "playlist",
        Settings => "settings",
        Calculator => "calculator",
        Notepad => "notepad",
        MorseTrainer => "morse_trainer",
        BandPlan => "band_plan",
        AntennaCalc => "antenna_calc",
        SignalMeter => "signal_meter",
        BtleRx => "btle_rx",
        BtleComm => "btle_comm",
        Nrf24Rx => "nrf24_rx",
        EncoderSuite => "encoder_suite",
        DecoderSuite => "decoder_suite",
        CaptureManager => "capture_manager",
        SpectrumPainter => "spectrum_painter",
        RfCharacterize => "rf_characterize",
        ProtocolAnalyzer => "protocol_analyzer",
        RemoteControl => "remote_control",
        IqPlayer => "iq_player",
        SdrBenchmark => "sdr_benchmark",
        FreqCounter => "freq_counter",
        CtcssDcs => "ctcss_dcs",
        DmrRx => "dmr_rx",
        DpmrRx => "dpmr_rx",
        P25Rx => "p25_rx",
        NxdnRx => "nxdn_rx",
        TetraRx => "tetra_rx",
        PagerAggregator => "pager_aggregator",
    }
}

pub fn slug_for(app: AppId) -> &'static str {
    app_id_slug(app)
}

pub fn parse_slug(slug: &str) -> Option<AppId> {
    use AppId::*;
    let id = match slug {
        "nfm_audio" => NfmAudio, "adsb_rx" => AdsbRx, "pocsag_tx" => PocsagTx,
        "wfm_rx" => WfmRx, "am_rx" => AmRx, "usb_rx" => UsbRx, "lsb_rx" => LsbRx,
        "cw_rx" => CwRx, "rds_rx" => RdsRx, "aprs_rx" => AprsRx, "ais_rx" => AisRx,
        "acars_rx" => AcarsRx, "pocsag_rx" => PocsagRx, "afsk_rx" => AfskRx,
        "ert_rx" => ErtRx, "weather_rx" => WeatherRx, "sonde_rx" => SondeRx,
        "two_tone_rx" => TwoToneRx, "flex_rx" => FlexRx, "tpms_rx" => TpmsRx,
        "ook_analyzer" => OokAnalyzer, "scanner" => Scanner, "recon" => Recon,
        "looking_glass" => LookingGlass, "sig_gen" => SigGen, "ook_decoders" => OokDecoders,
        "sub_ghz_capture" => SubGhzCapture, "apt_rx" => AptRx, "dsc_rx" => DscRx,
        "epirb_rx" => EpirbRx, "sonde_rx_ext" => SondeRxExt, "dab_rx" => DabRx,
        "hrpt_rx" => HrptRx, "lrpt_rx" => LrptRx, "adsb_rx_ext" => AdsbRxExt,
        "rtty_tx" => RttyTx, "sstv_tx" => SstvTx, "afsk_tx" => AfskTx,
        "morse_tx" => MorseTx, "soundboard_tx" => SoundboardTx, "flex_tx" => FlexTx,
        "adsb_tx" => AdsbTx, "gps_sim" => GpsSim, "mdc1200_tx" => Mdc1200Tx,
        "replay_tx" => ReplayTx, "ook_editor_tx" => OokEditorTx, "freq_hopper" => FreqHopper,
        "btle_tx" => BtleTx, "nrf24_tx" => Nrf24Tx, "rfm69_tx" => Rfm69Tx,
        "flipper_tx" => FlipperTx, "keyfob_tx" => KeyfobTx, "lge_tx" => LgeTx,
        "signal_meter" => SignalMeter, "btle_rx" => BtleRx, "btle_comm" => BtleComm,
        "nrf24_rx" => Nrf24Rx, "encoder_suite" => EncoderSuite,
        "decoder_suite" => DecoderSuite, "capture_manager" => CaptureManager,
        "spectrum_painter" => SpectrumPainter, "rf_characterize" => RfCharacterize,
        "protocol_analyzer" => ProtocolAnalyzer, "remote_control" => RemoteControl,
        "iq_player" => IqPlayer, "sdr_benchmark" => SdrBenchmark,
        "freq_counter" => FreqCounter, "ctcss_dcs" => CtcssDcs,
        "dmr_rx" => DmrRx, "dpmr_rx" => DpmrRx, "p25_rx" => P25Rx,
        "nxdn_rx" => NxdnRx, "tetra_rx" => TetraRx, "pager_aggregator" => PagerAggregator,
        _ => return None,
    };
    Some(id)
}

/// Scan the recordings root and return metadata for each saved recording.
pub fn list_recordings(root: &Path, filter_app: Option<AppId>) -> Result<Vec<RecordingMeta>> {
    let mut out = Vec::new();
    if !root.exists() {
        return Ok(out);
    }
    for app_entry in std::fs::read_dir(root)? {
        let app_entry = app_entry?;
        let app_path = app_entry.path();
        if !app_path.is_dir() {
            continue;
        }
        let slug = match app_path.file_name().and_then(|s| s.to_str()) {
            Some(s) => s,
            None => continue,
        };
        let app_id = match parse_slug(slug) {
            Some(id) => id,
            None => continue,
        };
        if let Some(want) = filter_app {
            if want != app_id {
                continue;
            }
        }
        for rec_entry in std::fs::read_dir(&app_path)? {
            let rec_entry = rec_entry?;
            let path = rec_entry.path();
            let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("");
            let format = match ext {
                "wav" => RecordingFormat::Wav,
                "jsonl" => RecordingFormat::Jsonl,
                "cs8" => RecordingFormat::Iq,
                "png" => RecordingFormat::Img,
                _ => continue,
            };
            let meta = rec_entry.metadata()?;
            let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("");
            let modified_unix_ms = meta.modified().ok()
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as f64)
                .unwrap_or(0.0);

            // Try sidecar for IQ — look up center_hz and duration.
            let mut center_hz: Option<f64> = None;
            let mut duration_ms = 0.0;
            if matches!(format, RecordingFormat::Iq) {
                let sidecar = path.with_extension("json");
                if let Ok(s) = std::fs::read_to_string(&sidecar) {
                    if let Ok(v) = serde_json::from_str::<serde_json::Value>(&s) {
                        center_hz = v.get("center_hz").and_then(|x| x.as_f64());
                        duration_ms = v.get("duration_s").and_then(|x| x.as_f64()).unwrap_or(0.0) * 1000.0;
                    }
                }
            }

            out.push(RecordingMeta {
                id: format!("{}-{}", slug, stem),
                app_id,
                format,
                path: path.to_string_lossy().to_string(),
                started_unix_ms: modified_unix_ms,
                duration_ms,
                size_bytes: meta.len() as f64,
                center_hz,
            });
        }
    }
    out.sort_by(|a, b| b.started_unix_ms.partial_cmp(&a.started_unix_ms).unwrap_or(std::cmp::Ordering::Equal));
    Ok(out)
}

pub fn delete_recording(path: &Path) -> Result<()> {
    if !path.exists() {
        return Err(anyhow!("recording not found: {}", path.display()));
    }
    std::fs::remove_file(path)?;
    let sidecar = path.with_extension("json");
    if sidecar.exists() {
        let _ = std::fs::remove_file(sidecar);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn timestamp_format() {
        // 2026-01-01 00:00:00 UTC = 1767225600
        let s = epoch_to_ymdhms(1_767_225_600);
        assert_eq!(s, (2026, 1, 1, 0, 0, 0));
        // 2024-02-29 12:34:56 UTC (leap day) = 1709210096
        let s = epoch_to_ymdhms(1_709_210_096);
        assert_eq!(s, (2024, 2, 29, 12, 34, 56));
    }

    #[test]
    fn wav_record_round_trip() {
        let dir = tempfile::tempdir().unwrap();
        let mut rec = ActiveRecording::new(AppId::NfmAudio, RecordingFormat::Wav, dir.path(), None).unwrap();
        let frame = AudioFrame { seq: 0, samples: vec![0i16, 1, 2, 3] };
        rec.write_audio(&frame).unwrap();
        let meta = rec.finish().unwrap();
        assert_eq!(meta.format, RecordingFormat::Wav);
        let bytes = std::fs::read(&meta.path).unwrap();
        // RIFF header + 4 samples * 2 bytes = 44 + 8.
        assert_eq!(bytes.len(), 52);
        assert_eq!(&bytes[0..4], b"RIFF");
        assert_eq!(&bytes[8..12], b"WAVE");
    }

    #[test]
    fn jsonl_writes_one_line_per_event() {
        let dir = tempfile::tempdir().unwrap();
        let mut rec = ActiveRecording::new(AppId::AdsbRx, RecordingFormat::Jsonl, dir.path(), None).unwrap();
        rec.write_event(&serde_json::json!({"a": 1})).unwrap();
        rec.write_event(&serde_json::json!({"a": 2})).unwrap();
        let meta = rec.finish().unwrap();
        let s = std::fs::read_to_string(&meta.path).unwrap();
        assert_eq!(s.lines().count(), 2);
    }

    #[test]
    fn iq_writes_sidecar() {
        let dir = tempfile::tempdir().unwrap();
        let mut rec = ActiveRecording::new(AppId::PocsagTx, RecordingFormat::Iq, dir.path(), Some(433_000_000.0)).unwrap();
        rec.write_iq(&[1u8, 2, 3, 4]).unwrap();
        let meta = rec.finish().unwrap();
        let sidecar = std::path::PathBuf::from(&meta.path).with_extension("json");
        assert!(sidecar.exists());
        let s = std::fs::read_to_string(&sidecar).unwrap();
        assert!(s.contains("433000000"));
    }

    #[test]
    fn list_and_delete_recordings() {
        let dir = tempfile::tempdir().unwrap();
        let mut a = ActiveRecording::new(AppId::NfmAudio, RecordingFormat::Wav, dir.path(), None).unwrap();
        a.write_audio(&AudioFrame { seq: 0, samples: vec![0i16; 8] }).unwrap();
        let meta = a.finish().unwrap();
        let listed = list_recordings(dir.path(), None).unwrap();
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].path, meta.path);
        delete_recording(std::path::Path::new(&meta.path)).unwrap();
        let listed = list_recordings(dir.path(), None).unwrap();
        assert_eq!(listed.len(), 0);
    }

    #[test]
    fn parse_slug_round_trip() {
        for app in [AppId::NfmAudio, AppId::AdsbRx, AppId::TetraRx, AppId::PocsagTx] {
            let slug = slug_for(app);
            assert_eq!(parse_slug(slug), Some(app));
        }
    }
}
