//! AppRunner — a single-tenant manager of which app is currently running.
//! v0.1 supports one app at a time. Switching apps stops the current one cleanly.

use anyhow::Result;
use mayhem_apps::{
    acars_rx::AcarsRxApp, adsb_rx::AdsbRxApp, afsk_rx::AfskRxApp, ais_rx::AisRxApp,
    am_rx::AmRxApp, aprs_rx::AprsRxApp, cw_rx::CwRxApp, ert_rx::ErtRxApp,
    flex_rx::FlexRxApp, looking_glass::LookingGlassApp, nfm_audio::NfmAudioApp,
    ook_analyzer::OokAnalyzerApp, ook_decoders::OokDecodersApp, pocsag_rx::PocsagRxApp,
    pocsag_tx::PocsagTxApp, rds_rx::RdsRxApp, recon::ReconApp, scanner::ScannerApp,
    sig_gen_app::SigGenApp, sonde_rx::SondeRxApp, ssb_rx::SsbRxApp,
    subghz_capture::SubGhzCaptureApp, tpms_rx::TpmsRxApp, twotone_rx::TwoToneRxApp,
    weather_rx::WeatherRxApp, wfm_rx::WfmRxApp, App, AppRegistry, RunningApp,
};
use mayhem_ipc::{AircraftState, AppId, AppMetadata, AppStatus, AudioFrame, OokDecodeEvent, PocsagTxStatus, PulseEventIpc, RdsData, ScanResultEvent, SpectrumFrame, TpmsSensorEvent};
use serde_json::Value;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::{mpsc, Mutex};

pub struct AppRunner {
    registry: AppRegistry,
    state: Mutex<RunnerState>,
}

struct RunnerState {
    current: Option<(AppId, RunningApp)>,
}

impl AppRunner {
    pub fn new() -> Self {
        let mut registry = AppRegistry::new();
        registry.register(NfmAudioApp::metadata(), || {
            // Each registration produces a fresh app instance; the channel receivers
            // returned by `new()` are discarded here because the registry's instantiate()
            // path doesn't need them — runtime channels are owned by the actual `start_app`
            // path in `AppRunner::start`.
            let (app, _, _) = NfmAudioApp::new();
            app
        });
        registry.register(AdsbRxApp::metadata(), || {
            let (app, _) = AdsbRxApp::new();
            app
        });
        registry.register(PocsagTxApp::metadata(), || {
            let (app, _) = PocsagTxApp::new();
            app
        });
        registry.register(WfmRxApp::metadata(), || {
            let (app, _, _) = WfmRxApp::new();
            app
        });
        registry.register(AmRxApp::metadata(), || {
            let (app, _, _) = AmRxApp::new();
            app
        });
        registry.register(SsbRxApp::metadata_usb(), || {
            let (app, _, _) = SsbRxApp::new_usb();
            app
        });
        registry.register(SsbRxApp::metadata_lsb(), || {
            let (app, _, _) = SsbRxApp::new_lsb();
            app
        });
        registry.register(CwRxApp::metadata(), || {
            let (app, _, _) = CwRxApp::new();
            app
        });
        registry.register(RdsRxApp::metadata(), || {
            let (app, _, _, _) = RdsRxApp::new();
            app
        });
        registry.register(AprsRxApp::metadata(), || {
            let (app, _, _) = AprsRxApp::new();
            app
        });
        registry.register(AisRxApp::metadata(), || {
            let (app, _, _) = AisRxApp::new();
            app
        });
        registry.register(AcarsRxApp::metadata(), || {
            let (app, _, _) = AcarsRxApp::new();
            app
        });
        registry.register(PocsagRxApp::metadata(), || {
            let (app, _, _) = PocsagRxApp::new();
            app
        });
        registry.register(AfskRxApp::metadata(), || {
            let (app, _, _) = AfskRxApp::new();
            app
        });
        registry.register(ErtRxApp::metadata(), || {
            let (app, _, _) = ErtRxApp::new();
            app
        });
        registry.register(WeatherRxApp::metadata(), || {
            let (app, _, _) = WeatherRxApp::new();
            app
        });
        registry.register(SondeRxApp::metadata(), || {
            let (app, _, _) = SondeRxApp::new();
            app
        });
        registry.register(TwoToneRxApp::metadata(), || {
            let (app, _, _) = TwoToneRxApp::new();
            app
        });
        registry.register(FlexRxApp::metadata(), || {
            let (app, _, _) = FlexRxApp::new();
            app
        });
        registry.register(TpmsRxApp::metadata(), || {
            let (app, _, _) = TpmsRxApp::new();
            app
        });
        registry.register(OokAnalyzerApp::metadata(), || {
            let (app, _, _) = OokAnalyzerApp::new();
            app
        });
        registry.register(ScannerApp::metadata(), || {
            let (app, _, _) = ScannerApp::new();
            app
        });
        registry.register(ReconApp::metadata(), || {
            let (app, _, _) = ReconApp::new();
            app
        });
        registry.register(LookingGlassApp::metadata(), || {
            let (app, _, _) = LookingGlassApp::new();
            app
        });
        registry.register(SigGenApp::metadata(), || {
            let (app, _) = SigGenApp::new();
            app
        });
        registry.register(OokDecodersApp::metadata(), || {
            let (app, _, _) = OokDecodersApp::new();
            app
        });
        registry.register(SubGhzCaptureApp::metadata(), || {
            let (app, _, _) = SubGhzCaptureApp::new();
            app
        });
        Self {
            registry,
            state: Mutex::new(RunnerState { current: None }),
        }
    }

    pub fn list(&self) -> Vec<AppMetadata> {
        self.registry.list()
    }

    pub async fn start(self: &Arc<Self>, handle: AppHandle, id: AppId, params: Value) -> Result<()> {
        let mut state = self.state.lock().await;
        if let Some((cur_id, app)) = state.current.take() {
            tracing::info!(?cur_id, "stopping current app before switching");
            let _ = app.stop.send(());
            // Await full termination so the HackRF device handle is released before
            // the new app tries to claim it.
            let _ = app.join.await;
        }

        let _ = handle.emit("app_status", AppStatus::Starting { app: id });

        // TODO(v0.2): When Plan 2 adds ADS-B, generalize this match into a per-app
        // start trampoline. The registry's `instantiate()` path can't return the
        // app's channel receivers because `Box<dyn App>` erases concrete types;
        // extend the App trait with a `start_with_channels` typed wrapper, or move
        // channel ownership into the App trait itself.

        // For NFM specifically: instantiate, take its channels, spawn pumps that re-emit as Tauri events.
        match id {
            AppId::NfmAudio => {
                let (app, audio_rx, spec_rx) = NfmAudioApp::new();
                let running = app.start(params)?;
                spawn_event_pumps(handle.clone(), audio_rx, spec_rx);
                state.current = Some((id, running));
            }
            AppId::AdsbRx => {
                let (app, state_rx) = AdsbRxApp::new();
                let running = app.start(params)?;
                spawn_aircraft_pump(handle.clone(), state_rx);
                state.current = Some((id, running));
            }
            AppId::PocsagTx => {
                let (app, status_rx) = PocsagTxApp::new();
                let running = app.start(params)?;
                spawn_pocsag_status_pump(handle.clone(), status_rx);
                state.current = Some((id, running));
            }
            AppId::WfmRx => {
                let (app, audio_rx, spec_rx) = WfmRxApp::new();
                let running = app.start(params)?;
                spawn_event_pumps(handle.clone(), audio_rx, spec_rx);
                state.current = Some((id, running));
            }
            AppId::AmRx => {
                let (app, audio_rx, spec_rx) = AmRxApp::new();
                let running = app.start(params)?;
                spawn_event_pumps(handle.clone(), audio_rx, spec_rx);
                state.current = Some((id, running));
            }
            AppId::UsbRx => {
                let (app, audio_rx, spec_rx) = SsbRxApp::new_usb();
                let running = app.start(params)?;
                spawn_event_pumps(handle.clone(), audio_rx, spec_rx);
                state.current = Some((id, running));
            }
            AppId::LsbRx => {
                let (app, audio_rx, spec_rx) = SsbRxApp::new_lsb();
                let running = app.start(params)?;
                spawn_event_pumps(handle.clone(), audio_rx, spec_rx);
                state.current = Some((id, running));
            }
            AppId::CwRx => {
                let (app, audio_rx, spec_rx) = CwRxApp::new();
                let running = app.start(params)?;
                spawn_event_pumps(handle.clone(), audio_rx, spec_rx);
                state.current = Some((id, running));
            }
            AppId::RdsRx => {
                let (app, audio_rx, spec_rx, rds_rx) = RdsRxApp::new();
                let running = app.start(params)?;
                spawn_event_pumps(handle.clone(), audio_rx, spec_rx);
                spawn_rds_pump(handle.clone(), rds_rx);
                state.current = Some((id, running));
            }
            AppId::AprsRx => {
                let (app, event_rx, spec_rx) = AprsRxApp::new();
                let running = app.start(params)?;
                spawn_typed_pump(handle.clone(), "aprs_packet", event_rx);
                spawn_spec_pump(handle.clone(), spec_rx);
                state.current = Some((id, running));
            }
            AppId::AisRx => {
                let (app, event_rx, spec_rx) = AisRxApp::new();
                let running = app.start(params)?;
                spawn_typed_pump(handle.clone(), "ais_ship", event_rx);
                spawn_spec_pump(handle.clone(), spec_rx);
                state.current = Some((id, running));
            }
            AppId::AcarsRx => {
                let (app, event_rx, spec_rx) = AcarsRxApp::new();
                let running = app.start(params)?;
                spawn_typed_pump(handle.clone(), "acars_message", event_rx);
                spawn_spec_pump(handle.clone(), spec_rx);
                state.current = Some((id, running));
            }
            AppId::PocsagRx => {
                let (app, event_rx, spec_rx) = PocsagRxApp::new();
                let running = app.start(params)?;
                spawn_typed_pump(handle.clone(), "pocsag_page", event_rx);
                spawn_spec_pump(handle.clone(), spec_rx);
                state.current = Some((id, running));
            }
            AppId::AfskRx => {
                let (app, event_rx, spec_rx) = AfskRxApp::new();
                let running = app.start(params)?;
                spawn_typed_pump(handle.clone(), "afsk_bits", event_rx);
                spawn_spec_pump(handle.clone(), spec_rx);
                state.current = Some((id, running));
            }
            AppId::ErtRx => {
                let (app, event_rx, spec_rx) = ErtRxApp::new();
                let running = app.start(params)?;
                spawn_typed_pump(handle.clone(), "ert_meter", event_rx);
                spawn_spec_pump(handle.clone(), spec_rx);
                state.current = Some((id, running));
            }
            AppId::WeatherRx => {
                let (app, event_rx, spec_rx) = WeatherRxApp::new();
                let running = app.start(params)?;
                spawn_typed_pump(handle.clone(), "weather_reading", event_rx);
                spawn_spec_pump(handle.clone(), spec_rx);
                state.current = Some((id, running));
            }
            AppId::SondeRx => {
                let (app, event_rx, spec_rx) = SondeRxApp::new();
                let running = app.start(params)?;
                spawn_typed_pump(handle.clone(), "sonde_telemetry", event_rx);
                spawn_spec_pump(handle.clone(), spec_rx);
                state.current = Some((id, running));
            }
            AppId::TwoToneRx => {
                let (app, event_rx, spec_rx) = TwoToneRxApp::new();
                let running = app.start(params)?;
                spawn_typed_pump(handle.clone(), "two_tone_alert", event_rx);
                spawn_spec_pump(handle.clone(), spec_rx);
                state.current = Some((id, running));
            }
            AppId::FlexRx => {
                let (app, event_rx, spec_rx) = FlexRxApp::new();
                let running = app.start(params)?;
                spawn_typed_pump(handle.clone(), "flex_page", event_rx);
                spawn_spec_pump(handle.clone(), spec_rx);
                state.current = Some((id, running));
            }
            AppId::TpmsRx => {
                let (app, event_rx, spec_rx) = TpmsRxApp::new();
                let running = app.start(params)?;
                spawn_typed_pump::<TpmsSensorEvent>(handle.clone(), "tpms_sensor", event_rx);
                spawn_spec_pump(handle.clone(), spec_rx);
                state.current = Some((id, running));
            }
            AppId::OokAnalyzer => {
                let (app, event_rx, spec_rx) = OokAnalyzerApp::new();
                let running = app.start(params)?;
                spawn_typed_pump::<PulseEventIpc>(handle.clone(), "pulse_event", event_rx);
                spawn_spec_pump(handle.clone(), spec_rx);
                state.current = Some((id, running));
            }
            AppId::Scanner => {
                let (app, event_rx, spec_rx) = ScannerApp::new();
                let running = app.start(params)?;
                spawn_typed_pump::<ScanResultEvent>(handle.clone(), "scan_result", event_rx);
                spawn_spec_pump(handle.clone(), spec_rx);
                state.current = Some((id, running));
            }
            AppId::Recon => {
                let (app, event_rx, spec_rx) = ReconApp::new();
                let running = app.start(params)?;
                spawn_typed_pump::<ScanResultEvent>(handle.clone(), "scan_result", event_rx);
                spawn_spec_pump(handle.clone(), spec_rx);
                state.current = Some((id, running));
            }
            AppId::LookingGlass => {
                let (app, event_rx, spec_rx) = LookingGlassApp::new();
                let running = app.start(params)?;
                spawn_typed_pump::<ScanResultEvent>(handle.clone(), "scan_result", event_rx);
                spawn_spec_pump(handle.clone(), spec_rx);
                state.current = Some((id, running));
            }
            AppId::SigGen => {
                let (app, status_rx) = SigGenApp::new();
                let running = app.start(params)?;
                spawn_typed_pump::<PocsagTxStatus>(handle.clone(), "pocsag_tx_status", status_rx);
                state.current = Some((id, running));
            }
            AppId::OokDecoders => {
                let (app, event_rx, spec_rx) = OokDecodersApp::new();
                let running = app.start(params)?;
                spawn_typed_pump::<OokDecodeEvent>(handle.clone(), "ook_decode", event_rx);
                spawn_spec_pump(handle.clone(), spec_rx);
                state.current = Some((id, running));
            }
            AppId::SubGhzCapture => {
                let (app, event_rx, spec_rx) = SubGhzCaptureApp::new();
                let running = app.start(params)?;
                spawn_typed_pump::<PulseEventIpc>(handle.clone(), "pulse_event", event_rx);
                spawn_spec_pump(handle.clone(), spec_rx);
                state.current = Some((id, running));
            }
        }

        let _ = handle.emit("app_status", AppStatus::Running { app: id });
        Ok(())
    }

    pub async fn stop(&self, handle: AppHandle) -> Result<()> {
        let mut state = self.state.lock().await;
        if let Some((id, app)) = state.current.take() {
            let _ = handle.emit("app_status", AppStatus::Stopping);
            let _ = app.stop.send(());
            let _ = app.join.await;
            tracing::info!(?id, "stop signal sent, app joined");
        }
        let _ = handle.emit("app_status", AppStatus::Idle);
        Ok(())
    }
}

fn spawn_rds_pump(
    handle: AppHandle,
    mut rds_rx: mpsc::UnboundedReceiver<RdsData>,
) {
    tokio::spawn(async move {
        while let Some(data) = rds_rx.recv().await {
            let _ = handle.emit("rds_data", &data);
        }
    });
}

fn spawn_pocsag_status_pump(
    handle: AppHandle,
    mut status_rx: mpsc::UnboundedReceiver<PocsagTxStatus>,
) {
    tokio::spawn(async move {
        while let Some(status) = status_rx.recv().await {
            let _ = handle.emit("pocsag_tx_status", &status);
        }
    });
}

fn spawn_aircraft_pump(
    handle: AppHandle,
    mut state_rx: mpsc::UnboundedReceiver<AircraftState>,
) {
    tokio::spawn(async move {
        while let Some(s) = state_rx.recv().await {
            let _ = handle.emit("aircraft_state", s);
        }
    });
}

fn spawn_event_pumps(
    handle: AppHandle,
    mut audio_rx: mpsc::UnboundedReceiver<AudioFrame>,
    mut spec_rx: mpsc::UnboundedReceiver<SpectrumFrame>,
) {
    let h1 = handle.clone();
    tokio::spawn(async move {
        while let Some(frame) = audio_rx.recv().await {
            let _ = h1.emit("audio", frame);
        }
    });
    let h2 = handle.clone();
    tokio::spawn(async move {
        while let Some(frame) = spec_rx.recv().await {
            let _ = h2.emit("spectrum", frame);
        }
    });
}

fn spawn_typed_pump<T: serde::Serialize + Clone + Send + 'static>(
    handle: AppHandle,
    event_name: &'static str,
    mut rx: mpsc::UnboundedReceiver<T>,
) {
    tokio::spawn(async move {
        while let Some(evt) = rx.recv().await {
            let _ = handle.emit(event_name, &evt);
        }
    });
}

fn spawn_spec_pump(handle: AppHandle, mut rx: mpsc::UnboundedReceiver<SpectrumFrame>) {
    tokio::spawn(async move {
        while let Some(frame) = rx.recv().await {
            let _ = handle.emit("spectrum", frame);
        }
    });
}
