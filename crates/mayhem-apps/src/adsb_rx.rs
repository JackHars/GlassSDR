//! ADS-B receiver app. Pipeline:
//!   HackRF @ 2 Msps (1090 MHz) → magnitude_squared → preamble detect → PPM slice
//!     → CRC + DF17 frame parse → callsign / position / velocity decode → AircraftState diff

use anyhow::Result;
use mayhem_dsp::{magnitude::magnitude_squared, ppm::slice_frame, preamble::detect};
use mayhem_ipc::{
    AdsbPosition, AdsbVelocity, AircraftState, AppId, AppMetadata, Direction, RegulatoryClass,
};
use mayhem_protocols::adsb::{
    callsign::decode as decode_callsign,
    frame::AdsbFrame,
    position::{decode_global, decode_local, CprFrame},
    velocity::decode as decode_velocity,
};
use mayhem_radio::{build_source, HackRfSourceConfig};
use num_complex::Complex32;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::sync::{mpsc, oneshot};
use tracing::{info, warn};

use crate::{App, RunningApp};

const HACKRF_RATE: f64 = 2_000_000.0;
const ADS_B_FREQ_HZ: f64 = 1_090_000_000.0;
/// Window size for IQ accumulation before scanning for preambles.
/// At 2 Msps: 4096 samples = 2.048 ms. A full DF17 frame is 16+224 = 240 samples.
const IQ_WINDOW_LEN: usize = 4096;

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
pub struct AdsbParams {
    pub ref_lat: Option<f64>,
    pub ref_lon: Option<f64>,
    pub lna_gain_db: Option<u32>,
    pub vga_gain_db: Option<u32>,
}

pub struct AdsbRxApp {
    pub state_tx: mpsc::UnboundedSender<AircraftState>,
}

impl AdsbRxApp {
    pub fn new() -> (Self, mpsc::UnboundedReceiver<AircraftState>) {
        let (tx, rx) = mpsc::unbounded_channel();
        (Self { state_tx: tx }, rx)
    }
}

impl App for AdsbRxApp {
    fn metadata() -> AppMetadata
    where
        Self: Sized,
    {
        AppMetadata {
            id: AppId::AdsbRx,
            name: "ADS-B".to_string(),
            direction: Direction::Rx,
            regulatory_class: RegulatoryClass::Passive,
        }
    }

    fn start(&self, params: Value) -> Result<RunningApp> {
        let p: AdsbParams = serde_json::from_value(params).unwrap_or_default();
        let cfg = HackRfSourceConfig {
            center_hz: ADS_B_FREQ_HZ,
            sample_rate: HACKRF_RATE,
            lna_gain_db: p.lna_gain_db.unwrap_or(40),
            vga_gain_db: p.vga_gain_db.unwrap_or(40),
            amp_enabled: true,
        };
        cfg.validate()?;

        let state_tx = self.state_tx.clone();
        let (stop_tx, stop_rx) = oneshot::channel::<()>();

        let join = tokio::spawn(async move {
            if let Err(e) = run_adsb(cfg, p, state_tx, stop_rx).await {
                warn!("adsb flowgraph terminated with error: {e}");
            } else {
                info!("adsb flowgraph stopped cleanly");
            }
        });

        Ok(RunningApp { stop: stop_tx, join })
    }
}

async fn run_adsb(
    cfg: HackRfSourceConfig,
    params: AdsbParams,
    state_tx: mpsc::UnboundedSender<AircraftState>,
    stop_rx: oneshot::Receiver<()>,
) -> Result<()> {
    use futuresdr::macros::connect;
    use futuresdr::runtime::Flowgraph;

    // The aggregator lives in a std Mutex so it can be accessed from the smol-driven Apply
    // closure without mixing async runtimes.
    let aggregator = Arc::new(Mutex::new(AdsbAggregator::new(params)));

    // Shared FlowgraphHandle to allow stop signaling from the tokio side.
    let fg_handle_shared: Arc<Mutex<Option<futuresdr::runtime::FlowgraphHandle>>> =
        Arc::new(Mutex::new(None));
    let fg_handle_for_stop = Arc::clone(&fg_handle_shared);

    let agg = Arc::clone(&aggregator);
    let state_tx_inner = state_tx.clone();

    // IQ window and magnitude buffer are allocated once and moved into the Apply closure.
    let mut iq_window: Vec<Complex32> = Vec::with_capacity(IQ_WINDOW_LEN);
    let mut mag_window: Vec<f32> = vec![0.0f32; IQ_WINDOW_LEN];

    // detector_sink: accumulates IQ samples into a window, runs preamble scan when full,
    // dispatches any DF17 frames to the aggregator, passes samples through to the null sink.
    let detector_sink = futuresdr::blocks::Apply::new(move |x: &Complex32| -> Complex32 {
        iq_window.push(*x);
        if iq_window.len() >= IQ_WINDOW_LEN {
            magnitude_squared(&iq_window, &mut mag_window);
            let mut i = 0usize;
            // Each preamble+payload takes 16 + 224 = 240 samples.
            while i + 16 + 224 <= IQ_WINDOW_LEN {
                if detect(&mag_window, i).is_some() {
                    let data_start = i + 16;
                    if let Some(frame_bytes) = slice_frame(&mag_window, data_start) {
                        // frame_bytes is [u8; 14] on the stack; AdsbFrame borrows it.
                        if let Ok(frame) = AdsbFrame::parse(&frame_bytes) {
                            let icao24_hex = format!(
                                "{:02X}{:02X}{:02X}",
                                frame.icao24[0], frame.icao24[1], frame.icao24[2]
                            );
                            let updated = {
                                let mut agg_guard = agg.lock().unwrap();
                                agg_guard.ingest(&icao24_hex, &frame)
                            };
                            if let Some(s) = updated {
                                let _ = state_tx_inner.send(s);
                            }
                        }
                        // Skip past this frame whether or not it parsed cleanly.
                        i += 16 + 224;
                        continue;
                    }
                }
                i += 1;
            }
            iq_window.clear();
        }
        *x
    });

    let null = futuresdr::blocks::NullSink::<Complex32>::new();

    let cfg_thread = cfg;

    // Run the FutureSDR flowgraph in a tokio blocking thread so the smol runtime
    // doesn't block the tokio executor, and so we can race it against a stop signal.
    let rt_join = tokio::task::spawn_blocking(move || -> Result<()> {
        let mut fg = Flowgraph::new();
        let src = build_source(&cfg_thread)?;
        connect!(fg, src > detector_sink > null);

        let rt = futuresdr::runtime::Runtime::new();
        let (task, handle) = rt.start_sync(fg);

        // Publish handle so the stop path can call terminate().
        *fg_handle_shared.lock().unwrap() = Some(handle);

        async_io::block_on(task).map_err(|e| anyhow::anyhow!("adsb flowgraph error: {e}"))?;
        Ok(())
    });

    // Race the stop signal against natural flowgraph termination.
    tokio::select! {
        _ = stop_rx => {
            info!("adsb received stop signal; terminating flowgraph");
            tokio::task::spawn_blocking(move || {
                let mut guard = fg_handle_for_stop.lock().unwrap();
                if let Some(ref mut handle) = *guard {
                    async_io::block_on(handle.terminate_and_wait())
                        .unwrap_or_else(|e| warn!("adsb terminate_and_wait error: {e}"));
                }
            })
            .await
            .unwrap_or_else(|e| warn!("adsb spawn_blocking join error: {e}"));
        }
        res = rt_join => {
            match res {
                Ok(Ok(())) => info!("adsb flowgraph terminated naturally"),
                Ok(Err(e)) => warn!("adsb flowgraph error: {e}"),
                Err(e) => warn!("adsb runtime task join error: {e}"),
            }
        }
    }
    Ok(())
}

// ── Aggregator ───────────────────────────────────────────────────────────────

struct AdsbAggregator {
    /// Latest decoded state keyed by ICAO24 hex string.
    state: HashMap<String, AircraftState>,
    /// Pending CPR frames: (even, odd, timestamp_ms_of_last_update).
    cpr_pending: HashMap<String, (Option<CprFrame>, Option<CprFrame>, f64)>,
    params: AdsbParams,
}

impl AdsbAggregator {
    fn new(params: AdsbParams) -> Self {
        Self {
            state: HashMap::new(),
            cpr_pending: HashMap::new(),
            params,
        }
    }

    fn now_ms() -> f64 {
        chrono::Utc::now().timestamp_millis() as f64
    }

    /// Ingest a parsed DF17 frame. Returns the updated AircraftState if any field changed.
    fn ingest(&mut self, icao24_hex: &str, frame: &AdsbFrame<'_>) -> Option<AircraftState> {
        let now = Self::now_ms();
        let entry = self
            .state
            .entry(icao24_hex.to_string())
            .or_insert_with(|| AircraftState {
                icao24: icao24_hex.to_string(),
                callsign: None,
                position: None,
                velocity: None,
                last_seen_ms: now,
            });
        entry.last_seen_ms = now;

        let mut changed = true;
        match frame.tc {
            // TC 1–4: Aircraft Identification (callsign)
            1..=4 => {
                let cs = decode_callsign(frame.me);
                if entry.callsign.as_deref() != Some(cs.as_str()) {
                    entry.callsign = Some(cs);
                } else {
                    changed = false;
                }
            }
            // TC 9–18, 20–22: Airborne Position
            9..=18 | 20..=22 => {
                let cpr = CprFrame::parse(frame.me);
                let cpr_is_odd = cpr.odd;
                let pending = self
                    .cpr_pending
                    .entry(icao24_hex.to_string())
                    .or_insert((None, None, 0.0));
                if cpr_is_odd {
                    pending.1 = Some(cpr);
                } else {
                    pending.0 = Some(cpr);
                }
                pending.2 = now;

                // Try global decode if we have both even and odd frames; fall back to local
                // decode if a reference position is configured.
                let pos = if let (Some(even), Some(odd)) = (pending.0, pending.1) {
                    // even_received_first = true means even is the most recently stored frame.
                    decode_global(&even, &odd, !cpr_is_odd)
                } else if let (Some(ref_lat), Some(ref_lon)) =
                    (self.params.ref_lat, self.params.ref_lon)
                {
                    Some(decode_local(&cpr, ref_lat, ref_lon))
                } else {
                    None
                };

                if let Some((lat, lon)) = pos {
                    let new_pos = AdsbPosition {
                        lat,
                        lon,
                        altitude_ft: cpr.altitude_ft,
                    };
                    if position_eq_approx(&entry.position, &new_pos) {
                        changed = false;
                    } else {
                        entry.position = Some(new_pos);
                    }
                } else {
                    changed = false;
                }
            }
            // TC 19: Airborne Velocity
            19 => {
                if let Some(v) = decode_velocity(frame.me) {
                    let new_vel = AdsbVelocity {
                        ground_speed_kt: v.ground_speed_kt,
                        heading_deg: v.heading_deg,
                        vert_rate_fpm: v.vert_rate_fpm,
                    };
                    if velocity_eq_approx(&entry.velocity, &new_vel) {
                        changed = false;
                    } else {
                        entry.velocity = Some(new_vel);
                    }
                } else {
                    changed = false;
                }
            }
            _ => {
                changed = false;
            }
        }
        if changed {
            Some(entry.clone())
        } else {
            None
        }
    }
}

fn position_eq_approx(prior: &Option<AdsbPosition>, new: &AdsbPosition) -> bool {
    match prior {
        Some(p) => {
            (p.lat - new.lat).abs() < 1e-7
                && (p.lon - new.lon).abs() < 1e-7
                && p.altitude_ft == new.altitude_ft
        }
        None => false,
    }
}

fn velocity_eq_approx(prior: &Option<AdsbVelocity>, new: &AdsbVelocity) -> bool {
    match prior {
        Some(v) => {
            (v.ground_speed_kt - new.ground_speed_kt).abs() < 0.5
                && (v.heading_deg - new.heading_deg).abs() < 0.5
                && v.vert_rate_fpm == new.vert_rate_fpm
        }
        None => false,
    }
}
