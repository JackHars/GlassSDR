//! AppRunner — a single-tenant manager of which app is currently running.
//! v0.1 supports one app at a time. Switching apps stops the current one cleanly.

use anyhow::Result;
use mayhem_apps::{
    acars_rx::AcarsRxApp, adsb_rx::AdsbRxApp, adsb_rx_ext::AdsbRxExtApp,
    afsk_rx::AfskRxApp, afsk_tx::AfskTxApp, ais_rx::AisRxApp,
    am_rx::AmRxApp, aprs_rx::AprsRxApp, apt_rx::AptRxApp, cw_rx::CwRxApp,
    dab_rx::DabRxApp, dsc_rx::DscRxApp, epirb_rx::EpirbRxApp, ert_rx::ErtRxApp,
    flex_rx::FlexRxApp, flex_tx::FlexTxApp, hrpt_rx::HrptRxApp, looking_glass::LookingGlassApp,
    lrpt_rx::LrptRxApp, morse_tx::MorseTxApp, nfm_audio::NfmAudioApp,
    ook_analyzer::OokAnalyzerApp, ook_decoders::OokDecodersApp, pocsag_rx::PocsagRxApp,
    pocsag_tx::PocsagTxApp, rds_rx::RdsRxApp, recon::ReconApp, rtty_tx::RttyTxApp,
    scanner::ScannerApp, sig_gen_app::SigGenApp, sonde_rx::SondeRxApp,
    sonde_rx_ext::SondeRxExtApp, soundboard_tx::SoundboardTxApp, sstv_tx::SstvTxApp,
    ssb_rx::SsbRxApp, subghz_capture::SubGhzCaptureApp, tpms_rx::TpmsRxApp,
    twotone_rx::TwoToneRxApp, weather_rx::WeatherRxApp, wfm_rx::WfmRxApp,
    adsb_tx::AdsbTxApp, gps_sim::GpsSimApp, mdc1200_tx::Mdc1200TxApp,
    replay_tx::ReplayTxApp, ook_editor_tx::OokEditorTxApp, freq_hopper::FreqHopperApp,
    btle_tx::BtleTxApp, nrf24_tx::Nrf24TxApp, rfm69_tx::Rfm69TxApp,
    flipper_tx::FlipperTxApp, keyfob_tx::KeyfobTxApp, lge_tx::LgeTxApp,
    App, AppRegistry, RunningApp,
};
use mayhem_ipc::{AircraftState, AppId, AppMetadata, AppStatus, AudioFrame, AptLineEvent, DabServiceEvent, DscMessageEvent, EpirbBeaconEvent, OokDecodeEvent, PocsagTxStatus, PulseEventIpc, RdsData, ScanResultEvent, SondeEvent, SpectrumFrame, TpmsSensorEvent};
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
        registry.register(AptRxApp::metadata(), || {
            let (app, _, _) = AptRxApp::new();
            app
        });
        registry.register(DscRxApp::metadata(), || {
            let (app, _, _) = DscRxApp::new();
            app
        });
        registry.register(EpirbRxApp::metadata(), || {
            let (app, _, _) = EpirbRxApp::new();
            app
        });
        registry.register(SondeRxExtApp::metadata(), || {
            let (app, _, _) = SondeRxExtApp::new();
            app
        });
        registry.register(DabRxApp::metadata(), || {
            let (app, _, _) = DabRxApp::new();
            app
        });
        registry.register(HrptRxApp::metadata(), || {
            let (app, _, _) = HrptRxApp::new();
            app
        });
        registry.register(LrptRxApp::metadata(), || {
            let (app, _, _) = LrptRxApp::new();
            app
        });
        registry.register(AdsbRxExtApp::metadata(), || {
            let (app, _) = AdsbRxExtApp::new();
            app
        });
        registry.register(RttyTxApp::metadata(), || {
            let (app, _) = RttyTxApp::new();
            app
        });
        registry.register(SstvTxApp::metadata(), || {
            let (app, _) = SstvTxApp::new();
            app
        });
        registry.register(AfskTxApp::metadata(), || {
            let (app, _) = AfskTxApp::new();
            app
        });
        registry.register(MorseTxApp::metadata(), || {
            let (app, _) = MorseTxApp::new();
            app
        });
        registry.register(SoundboardTxApp::metadata(), || {
            let (app, _) = SoundboardTxApp::new();
            app
        });
        registry.register(FlexTxApp::metadata(), || {
            let (app, _) = FlexTxApp::new();
            app
        });
        registry.register(AdsbTxApp::metadata(), || {
            let (app, _) = AdsbTxApp::new();
            app
        });
        registry.register(GpsSimApp::metadata(), || {
            let (app, _) = GpsSimApp::new();
            app
        });
        registry.register(Mdc1200TxApp::metadata(), || {
            let (app, _) = Mdc1200TxApp::new();
            app
        });
        registry.register(ReplayTxApp::metadata(), || {
            let (app, _) = ReplayTxApp::new();
            app
        });
        registry.register(OokEditorTxApp::metadata(), || {
            let (app, _) = OokEditorTxApp::new();
            app
        });
        registry.register(FreqHopperApp::metadata(), || {
            let (app, _) = FreqHopperApp::new();
            app
        });
        registry.register(BtleTxApp::metadata(), || {
            let (app, _) = BtleTxApp::new();
            app
        });
        registry.register(Nrf24TxApp::metadata(), || {
            let (app, _) = Nrf24TxApp::new();
            app
        });
        registry.register(Rfm69TxApp::metadata(), || {
            let (app, _) = Rfm69TxApp::new();
            app
        });
        registry.register(FlipperTxApp::metadata(), || {
            let (app, _) = FlipperTxApp::new();
            app
        });
        registry.register(KeyfobTxApp::metadata(), || {
            let (app, _) = KeyfobTxApp::new();
            app
        });
        registry.register(LgeTxApp::metadata(), || {
            let (app, _) = LgeTxApp::new();
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
            AppId::AptRx => {
                let (app, event_rx, spec_rx) = AptRxApp::new();
                let running = app.start(params)?;
                spawn_typed_pump::<AptLineEvent>(handle.clone(), "apt_line", event_rx);
                spawn_spec_pump(handle.clone(), spec_rx);
                state.current = Some((id, running));
            }
            AppId::DscRx => {
                let (app, event_rx, spec_rx) = DscRxApp::new();
                let running = app.start(params)?;
                spawn_typed_pump::<DscMessageEvent>(handle.clone(), "dsc_message", event_rx);
                spawn_spec_pump(handle.clone(), spec_rx);
                state.current = Some((id, running));
            }
            AppId::EpirbRx => {
                let (app, event_rx, spec_rx) = EpirbRxApp::new();
                let running = app.start(params)?;
                spawn_typed_pump::<EpirbBeaconEvent>(handle.clone(), "epirb_beacon", event_rx);
                spawn_spec_pump(handle.clone(), spec_rx);
                state.current = Some((id, running));
            }
            AppId::SondeRxExt => {
                let (app, event_rx, spec_rx) = SondeRxExtApp::new();
                let running = app.start(params)?;
                spawn_typed_pump::<SondeEvent>(handle.clone(), "sonde_telemetry", event_rx);
                spawn_spec_pump(handle.clone(), spec_rx);
                state.current = Some((id, running));
            }
            AppId::DabRx => {
                let (app, event_rx, spec_rx) = DabRxApp::new();
                let running = app.start(params)?;
                spawn_typed_pump::<DabServiceEvent>(handle.clone(), "dab_service", event_rx);
                spawn_spec_pump(handle.clone(), spec_rx);
                state.current = Some((id, running));
            }
            AppId::HrptRx => {
                let (app, event_rx, spec_rx) = HrptRxApp::new();
                let running = app.start(params)?;
                spawn_typed_pump::<AptLineEvent>(handle.clone(), "apt_line", event_rx);
                spawn_spec_pump(handle.clone(), spec_rx);
                state.current = Some((id, running));
            }
            AppId::LrptRx => {
                let (app, event_rx, spec_rx) = LrptRxApp::new();
                let running = app.start(params)?;
                spawn_typed_pump::<AptLineEvent>(handle.clone(), "apt_line", event_rx);
                spawn_spec_pump(handle.clone(), spec_rx);
                state.current = Some((id, running));
            }
            AppId::AdsbRxExt => {
                let (app, state_rx) = AdsbRxExtApp::new();
                let running = app.start(params)?;
                spawn_typed_pump::<AircraftState>(handle.clone(), "aircraft_state", state_rx);
                state.current = Some((id, running));
            }
            AppId::RttyTx => {
                let (app, status_rx) = RttyTxApp::new();
                let running = app.start(params)?;
                spawn_typed_pump::<PocsagTxStatus>(handle.clone(), "tx_status", status_rx);
                state.current = Some((id, running));
            }
            AppId::SstvTx => {
                let (app, status_rx) = SstvTxApp::new();
                let running = app.start(params)?;
                spawn_typed_pump::<PocsagTxStatus>(handle.clone(), "tx_status", status_rx);
                state.current = Some((id, running));
            }
            AppId::AfskTx => {
                let (app, status_rx) = AfskTxApp::new();
                let running = app.start(params)?;
                spawn_typed_pump::<PocsagTxStatus>(handle.clone(), "tx_status", status_rx);
                state.current = Some((id, running));
            }
            AppId::MorseTx => {
                let (app, status_rx) = MorseTxApp::new();
                let running = app.start(params)?;
                spawn_typed_pump::<PocsagTxStatus>(handle.clone(), "tx_status", status_rx);
                state.current = Some((id, running));
            }
            AppId::SoundboardTx => {
                let (app, status_rx) = SoundboardTxApp::new();
                let running = app.start(params)?;
                spawn_typed_pump::<PocsagTxStatus>(handle.clone(), "tx_status", status_rx);
                state.current = Some((id, running));
            }
            AppId::FlexTx => {
                let (app, status_rx) = FlexTxApp::new();
                let running = app.start(params)?;
                spawn_typed_pump::<PocsagTxStatus>(handle.clone(), "tx_status", status_rx);
                state.current = Some((id, running));
            }
            AppId::AdsbTx => {
                let (app, status_rx) = AdsbTxApp::new();
                let running = app.start(params)?;
                spawn_typed_pump::<PocsagTxStatus>(handle.clone(), "tx_status", status_rx);
                state.current = Some((id, running));
            }
            AppId::GpsSim => {
                let (app, status_rx) = GpsSimApp::new();
                let running = app.start(params)?;
                spawn_typed_pump::<PocsagTxStatus>(handle.clone(), "tx_status", status_rx);
                state.current = Some((id, running));
            }
            AppId::Mdc1200Tx => {
                let (app, status_rx) = Mdc1200TxApp::new();
                let running = app.start(params)?;
                spawn_typed_pump::<PocsagTxStatus>(handle.clone(), "tx_status", status_rx);
                state.current = Some((id, running));
            }
            AppId::ReplayTx => {
                let (app, status_rx) = ReplayTxApp::new();
                let running = app.start(params)?;
                spawn_typed_pump::<PocsagTxStatus>(handle.clone(), "tx_status", status_rx);
                state.current = Some((id, running));
            }
            AppId::OokEditorTx => {
                let (app, status_rx) = OokEditorTxApp::new();
                let running = app.start(params)?;
                spawn_typed_pump::<PocsagTxStatus>(handle.clone(), "tx_status", status_rx);
                state.current = Some((id, running));
            }
            AppId::FreqHopper => {
                let (app, status_rx) = FreqHopperApp::new();
                let running = app.start(params)?;
                spawn_typed_pump::<PocsagTxStatus>(handle.clone(), "tx_status", status_rx);
                state.current = Some((id, running));
            }
            AppId::BtleTx => {
                let (app, status_rx) = BtleTxApp::new();
                let running = app.start(params)?;
                spawn_typed_pump::<PocsagTxStatus>(handle.clone(), "tx_status", status_rx);
                state.current = Some((id, running));
            }
            AppId::Nrf24Tx => {
                let (app, status_rx) = Nrf24TxApp::new();
                let running = app.start(params)?;
                spawn_typed_pump::<PocsagTxStatus>(handle.clone(), "tx_status", status_rx);
                state.current = Some((id, running));
            }
            AppId::Rfm69Tx => {
                let (app, status_rx) = Rfm69TxApp::new();
                let running = app.start(params)?;
                spawn_typed_pump::<PocsagTxStatus>(handle.clone(), "tx_status", status_rx);
                state.current = Some((id, running));
            }
            AppId::FlipperTx => {
                let (app, status_rx) = FlipperTxApp::new();
                let running = app.start(params)?;
                spawn_typed_pump::<PocsagTxStatus>(handle.clone(), "tx_status", status_rx);
                state.current = Some((id, running));
            }
            AppId::KeyfobTx => {
                let (app, status_rx) = KeyfobTxApp::new();
                let running = app.start(params)?;
                spawn_typed_pump::<PocsagTxStatus>(handle.clone(), "tx_status", status_rx);
                state.current = Some((id, running));
            }
            AppId::LgeTx => {
                let (app, status_rx) = LgeTxApp::new();
                let running = app.start(params)?;
                spawn_typed_pump::<PocsagTxStatus>(handle.clone(), "tx_status", status_rx);
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
