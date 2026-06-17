import { useState, useEffect, lazy, Suspense } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listApps, listUsbDevices, UsbDevice } from "./ipc/commands";
import { useStore } from "./store";
import { AppGrid } from "./components/shell/AppGrid";
import { DashboardApp } from "./apps/dashboard/DashboardApp";
import { Icon } from "./components/kit/Icon";
import "./styles/glass.css";

// Lazy-load all app components for fast initial render
const NfmAudioApp = lazy(() => import("./apps/nfm-audio/NfmAudioApp").then(m => ({ default: m.NfmAudioApp })));
const AdsbRxApp = lazy(() => import("./apps/adsb-rx/AdsbRxApp").then(m => ({ default: m.AdsbRxApp })));
const PocsagTxApp = lazy(() => import("./apps/pocsag-tx/PocsagTxApp").then(m => ({ default: m.PocsagTxApp })));
const WfmRxApp = lazy(() => import("./apps/wfm-rx/WfmRxApp").then(m => ({ default: m.WfmRxApp })));
const AmRxApp = lazy(() => import("./apps/am-rx/AmRxApp").then(m => ({ default: m.AmRxApp })));
const SsbRxApp = lazy(() => import("./apps/ssb-rx/SsbRxApp").then(m => ({ default: m.SsbRxApp })));
const CwRxApp = lazy(() => import("./apps/cw-rx/CwRxApp").then(m => ({ default: m.CwRxApp })));
const RdsRxApp = lazy(() => import("./apps/rds-rx/RdsRxApp").then(m => ({ default: m.RdsRxApp })));
const AprsRxApp = lazy(() => import("./apps/aprs-rx/AprsRxApp").then(m => ({ default: m.AprsRxApp })));
const AisRxApp = lazy(() => import("./apps/ais-rx/AisRxApp").then(m => ({ default: m.AisRxApp })));
const AcarsRxApp = lazy(() => import("./apps/acars-rx/AcarsRxApp").then(m => ({ default: m.AcarsRxApp })));
const PocsagRxApp = lazy(() => import("./apps/pocsag-rx/PocsagRxApp").then(m => ({ default: m.PocsagRxApp })));
const AfskRxApp = lazy(() => import("./apps/afsk-rx/AfskRxApp").then(m => ({ default: m.AfskRxApp })));
const ErtRxApp = lazy(() => import("./apps/ert-rx/ErtRxApp").then(m => ({ default: m.ErtRxApp })));
const WeatherRxApp = lazy(() => import("./apps/weather-rx/WeatherRxApp").then(m => ({ default: m.WeatherRxApp })));
const SondeRxApp = lazy(() => import("./apps/sonde-rx/SondeRxApp").then(m => ({ default: m.SondeRxApp })));
const TwoToneRxApp = lazy(() => import("./apps/twotone-rx/TwoToneRxApp").then(m => ({ default: m.TwoToneRxApp })));
const FlexRxApp = lazy(() => import("./apps/flex-rx/FlexRxApp").then(m => ({ default: m.FlexRxApp })));
const TpmsRxApp = lazy(() => import("./apps/tpms-rx/TpmsRxApp").then(m => ({ default: m.TpmsRxApp })));
const OokAnalyzerApp = lazy(() => import("./apps/ook-analyzer/OokAnalyzerApp").then(m => ({ default: m.OokAnalyzerApp })));
const ScannerApp = lazy(() => import("./apps/scanner/ScannerApp").then(m => ({ default: m.ScannerApp })));
const ReconApp = lazy(() => import("./apps/recon/ReconApp").then(m => ({ default: m.ReconApp })));
const LookingGlassApp = lazy(() => import("./apps/looking-glass/LookingGlassApp").then(m => ({ default: m.LookingGlassApp })));
const SigGenApp = lazy(() => import("./apps/sig-gen/SigGenApp").then(m => ({ default: m.SigGenApp })));
const OokDecodersApp = lazy(() => import("./apps/ook-decoders/OokDecodersApp").then(m => ({ default: m.OokDecodersApp })));
const SubGhzCaptureApp = lazy(() => import("./apps/subghz-capture/SubGhzCaptureApp").then(m => ({ default: m.SubGhzCaptureApp })));
const AptRxApp = lazy(() => import("./apps/apt-rx/AptRxApp").then(m => ({ default: m.AptRxApp })));
const DscRxApp = lazy(() => import("./apps/dsc-rx/DscRxApp").then(m => ({ default: m.DscRxApp })));
const EpirbRxApp = lazy(() => import("./apps/epirb-rx/EpirbRxApp").then(m => ({ default: m.EpirbRxApp })));
const SondeRxExtApp = lazy(() => import("./apps/sonde-rx-ext/SondeRxExtApp").then(m => ({ default: m.SondeRxExtApp })));
const DabRxApp = lazy(() => import("./apps/dab-rx/DabRxApp").then(m => ({ default: m.DabRxApp })));
const HrptRxApp = lazy(() => import("./apps/hrpt-rx/HrptRxApp").then(m => ({ default: m.HrptRxApp })));
const LrptRxApp = lazy(() => import("./apps/lrpt-rx/LrptRxApp").then(m => ({ default: m.LrptRxApp })));
const AdsbExtApp = lazy(() => import("./apps/adsb-ext/AdsbExtApp").then(m => ({ default: m.AdsbExtApp })));
const RttyTxApp = lazy(() => import("./apps/rtty-tx/RttyTxApp").then(m => ({ default: m.RttyTxApp })));
const SstvTxApp = lazy(() => import("./apps/sstv-tx/SstvTxApp").then(m => ({ default: m.SstvTxApp })));
const AfskTxApp = lazy(() => import("./apps/afsk-tx/AfskTxApp").then(m => ({ default: m.AfskTxApp })));
const MorseTxApp = lazy(() => import("./apps/morse-tx/MorseTxApp").then(m => ({ default: m.MorseTxApp })));
const SoundboardTxApp = lazy(() => import("./apps/soundboard-tx/SoundboardTxApp").then(m => ({ default: m.SoundboardTxApp })));
const FlexTxApp = lazy(() => import("./apps/flex-tx/FlexTxApp").then(m => ({ default: m.FlexTxApp })));
const AdsbTxApp = lazy(() => import("./apps/adsb-tx/AdsbTxApp").then(m => ({ default: m.AdsbTxApp })));
const GpsSimApp = lazy(() => import("./apps/gps-sim/GpsSimApp").then(m => ({ default: m.GpsSimApp })));
const Mdc1200TxApp = lazy(() => import("./apps/mdc1200-tx/Mdc1200TxApp").then(m => ({ default: m.Mdc1200TxApp })));
const ReplayTxApp = lazy(() => import("./apps/replay-tx/ReplayTxApp").then(m => ({ default: m.ReplayTxApp })));
const OokEditorTxApp = lazy(() => import("./apps/ook-editor-tx/OokEditorTxApp").then(m => ({ default: m.OokEditorTxApp })));
const FreqHopperApp = lazy(() => import("./apps/freq-hopper/FreqHopperApp").then(m => ({ default: m.FreqHopperApp })));
const BtleTxApp = lazy(() => import("./apps/btle-tx/BtleTxApp").then(m => ({ default: m.BtleTxApp })));
const Nrf24TxApp = lazy(() => import("./apps/nrf24-tx/Nrf24TxApp").then(m => ({ default: m.Nrf24TxApp })));
const Rfm69TxApp = lazy(() => import("./apps/rfm69-tx/Rfm69TxApp").then(m => ({ default: m.Rfm69TxApp })));
const FlipperTxApp = lazy(() => import("./apps/flipper-tx/FlipperTxApp").then(m => ({ default: m.FlipperTxApp })));
const KeyfobTxApp = lazy(() => import("./apps/keyfob-tx/KeyfobTxApp").then(m => ({ default: m.KeyfobTxApp })));
const LgeTxApp = lazy(() => import("./apps/lge-tx/LgeTxApp").then(m => ({ default: m.LgeTxApp })));
const FreqManagerApp = lazy(() => import("./apps/freq-manager/FreqManagerApp").then(m => ({ default: m.FreqManagerApp })));
const PlaylistApp = lazy(() => import("./apps/playlist/PlaylistApp").then(m => ({ default: m.PlaylistApp })));
const SettingsApp = lazy(() => import("./apps/settings/SettingsApp").then(m => ({ default: m.SettingsApp })));
const CalculatorApp = lazy(() => import("./apps/calculator/CalculatorApp").then(m => ({ default: m.CalculatorApp })));
const NotepadApp = lazy(() => import("./apps/notepad/NotepadApp").then(m => ({ default: m.NotepadApp })));
const MorseTrainerApp = lazy(() => import("./apps/morse-trainer/MorseTrainerApp").then(m => ({ default: m.MorseTrainerApp })));
const BandPlanApp = lazy(() => import("./apps/band-plan/BandPlanApp").then(m => ({ default: m.BandPlanApp })));
const AntennaCalcApp = lazy(() => import("./apps/antenna-calc/AntennaCalcApp").then(m => ({ default: m.AntennaCalcApp })));
const SignalMeterApp = lazy(() => import("./apps/signal-meter/SignalMeterApp").then(m => ({ default: m.SignalMeterApp })));
const BtleRxApp = lazy(() => import("./apps/btle-rx/BtleRxApp").then(m => ({ default: m.BtleRxApp })));
const BtleCommApp = lazy(() => import("./apps/btle-comm/BtleCommApp").then(m => ({ default: m.BtleCommApp })));
const Nrf24RxApp = lazy(() => import("./apps/nrf24-rx/Nrf24RxApp").then(m => ({ default: m.Nrf24RxApp })));
const EncoderSuiteApp = lazy(() => import("./apps/encoder-suite/EncoderSuiteApp").then(m => ({ default: m.EncoderSuiteApp })));
const DecoderSuiteApp = lazy(() => import("./apps/decoder-suite/DecoderSuiteApp").then(m => ({ default: m.DecoderSuiteApp })));
const CaptureManagerApp = lazy(() => import("./apps/capture-manager/CaptureManagerApp").then(m => ({ default: m.CaptureManagerApp })));
const SpectrumPainterApp = lazy(() => import("./apps/spectrum-painter/SpectrumPainterApp").then(m => ({ default: m.SpectrumPainterApp })));
const RfCharApp = lazy(() => import("./apps/rf-char/RfCharApp").then(m => ({ default: m.RfCharApp })));
const ProtocolAnalyzerApp = lazy(() => import("./apps/protocol-analyzer/ProtocolAnalyzerApp").then(m => ({ default: m.ProtocolAnalyzerApp })));
const RemoteControlApp = lazy(() => import("./apps/remote-control/RemoteControlApp").then(m => ({ default: m.RemoteControlApp })));
const IqPlayerApp = lazy(() => import("./apps/iq-player/IqPlayerApp").then(m => ({ default: m.IqPlayerApp })));
const SdrBenchApp = lazy(() => import("./apps/sdr-bench/SdrBenchApp").then(m => ({ default: m.SdrBenchApp })));
const FreqCounterApp = lazy(() => import("./apps/freq-counter/FreqCounterApp").then(m => ({ default: m.FreqCounterApp })));
const CtcssDcsApp = lazy(() => import("./apps/ctcss-dcs/CtcssDcsApp").then(m => ({ default: m.CtcssDcsApp })));
const DmrRxApp = lazy(() => import("./apps/dmr-rx/DmrRxApp").then(m => ({ default: m.DmrRxApp })));
const DpmrRxApp = lazy(() => import("./apps/dpmr-rx/DpmrRxApp").then(m => ({ default: m.DpmrRxApp })));
const P25RxApp = lazy(() => import("./apps/p25-rx/P25RxApp").then(m => ({ default: m.P25RxApp })));
const NxdnRxApp = lazy(() => import("./apps/nxdn-rx/NxdnRxApp").then(m => ({ default: m.NxdnRxApp })));
const TetraRxApp = lazy(() => import("./apps/tetra-rx/TetraRxApp").then(m => ({ default: m.TetraRxApp })));
const PagerAggApp = lazy(() => import("./apps/pager-agg/PagerAggApp").then(m => ({ default: m.PagerAggApp })));
const RecordingsApp = lazy(() => import("./apps/recordings/RecordingsApp").then(m => ({ default: m.RecordingsApp })));

// Map of app ID → component
const APP_MAP: Record<string, React.LazyExoticComponent<React.ComponentType<any>>> = {
  nfm_audio: NfmAudioApp, adsb_rx: AdsbRxApp, pocsag_tx: PocsagTxApp,
  wfm_rx: WfmRxApp, am_rx: AmRxApp, cw_rx: CwRxApp, rds_rx: RdsRxApp,
  aprs_rx: AprsRxApp, ais_rx: AisRxApp, acars_rx: AcarsRxApp,
  pocsag_rx: PocsagRxApp, afsk_rx: AfskRxApp, ert_rx: ErtRxApp,
  weather_rx: WeatherRxApp, sonde_rx: SondeRxApp, two_tone_rx: TwoToneRxApp,
  flex_rx: FlexRxApp, tpms_rx: TpmsRxApp, ook_analyzer: OokAnalyzerApp,
  scanner: ScannerApp, recon: ReconApp, looking_glass: LookingGlassApp,
  sig_gen: SigGenApp, ook_decoders: OokDecodersApp, sub_ghz_capture: SubGhzCaptureApp,
  apt_rx: AptRxApp, dsc_rx: DscRxApp, epirb_rx: EpirbRxApp,
  sonde_rx_ext: SondeRxExtApp, dab_rx: DabRxApp, hrpt_rx: HrptRxApp,
  lrpt_rx: LrptRxApp, adsb_rx_ext: AdsbExtApp, rtty_tx: RttyTxApp,
  sstv_tx: SstvTxApp, afsk_tx: AfskTxApp, morse_tx: MorseTxApp,
  soundboard_tx: SoundboardTxApp, flex_tx: FlexTxApp, adsb_tx: AdsbTxApp,
  gps_sim: GpsSimApp, mdc1200_tx: Mdc1200TxApp, replay_tx: ReplayTxApp,
  ook_editor_tx: OokEditorTxApp, freq_hopper: FreqHopperApp, btle_tx: BtleTxApp,
  nrf24_tx: Nrf24TxApp, rfm69_tx: Rfm69TxApp, flipper_tx: FlipperTxApp,
  keyfob_tx: KeyfobTxApp, lge_tx: LgeTxApp, freq_manager: FreqManagerApp,
  playlist: PlaylistApp, settings: SettingsApp,
  calculator: CalculatorApp, notepad: NotepadApp,
  morse_trainer: MorseTrainerApp, band_plan: BandPlanApp, antenna_calc: AntennaCalcApp,
  signal_meter: SignalMeterApp, btle_rx: BtleRxApp, btle_comm: BtleCommApp,
  nrf24_rx: Nrf24RxApp, encoder_suite: EncoderSuiteApp, decoder_suite: DecoderSuiteApp,
  capture_manager: CaptureManagerApp, spectrum_painter: SpectrumPainterApp,
  rf_characterize: RfCharApp, protocol_analyzer: ProtocolAnalyzerApp,
  remote_control: RemoteControlApp, iq_player: IqPlayerApp, sdr_benchmark: SdrBenchApp,
  freq_counter: FreqCounterApp, ctcss_dcs: CtcssDcsApp, dmr_rx: DmrRxApp,
  dpmr_rx: DpmrRxApp, p25_rx: P25RxApp, nxdn_rx: NxdnRxApp, tetra_rx: TetraRxApp,
  pager_aggregator: PagerAggApp,
  recordings: RecordingsApp,
};

// Special cases that need props
const SPECIAL_APPS: Record<string, (props: any) => JSX.Element> = {
  usb_rx: () => <SsbRxApp appId="usb_rx" label="USB Receiver" />,
  lsb_rx: () => <SsbRxApp appId="lsb_rx" label="LSB Receiver" />,
};

function LoadingSpinner() {
  return (
    <div className="app-loading">
      <div className="app-loading-throbber" />
      <div className="app-loading-text">Loading…</div>
    </div>
  );
}

export default function App() {
  const setApps = useStore((s) => s.setApps);
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const [activeApp, setActiveApp] = useState<string | null>(null);
  const [browseAll, setBrowseAll] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState("");
  const [usbDevices, setUsbDevices] = useState<UsbDevice[]>([]);

  useEffect(() => {
    listApps().then(setApps);
  }, [setApps]);

  useEffect(() => {
    const refresh = () => {
      listUsbDevices().then((devices) => {
        // Only update state if device list actually changed
        setUsbDevices((prev) => {
          const prevIds = prev.map(d => d.id).join(",");
          const newIds = devices.map(d => d.id).join(",");
          if (prevIds === newIds) return prev;
          // Auto-select HackRF if available and nothing selected
          const hackrf = devices.find((d) => d.is_hackrf);
          if (hackrf && !selectedDevice) {
            setSelectedDevice(hackrf.id);
          }
          return devices;
        });
      }).catch(() => {});
    };
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleBack = () => setActiveApp(null);

  // Render active app or home grid
  const renderApp = () => {
    if (!activeApp) return null;

    // Special cases with props
    if (SPECIAL_APPS[activeApp]) {
      return (
        <Suspense fallback={<LoadingSpinner />}>
          {SPECIAL_APPS[activeApp]({})}
        </Suspense>
      );
    }

    const Component = APP_MAP[activeApp];
    if (!Component) return <div style={{ padding: 20, color: "var(--text-tertiary)" }}>App not found: {activeApp}</div>;

    return (
      <Suspense fallback={<LoadingSpinner />}>
        <Component />
      </Suspense>
    );
  };

  return (
    <>
      <div className="glass-bg" />
      <div className="app-content">
        {/* Top bar — draggable titlebar region */}
        <div
          className="top-bar"
          onMouseDown={(e) => {
            if ((e.target as HTMLElement).closest("button, select, a, input, .device-selector, .traffic-lights")) return;
            e.preventDefault();
            getCurrentWindow().startDragging();
          }}
          onDoubleClick={(e) => {
            if ((e.target as HTMLElement).closest("button, select, a, input, .device-selector, .traffic-lights")) return;
            getCurrentWindow().toggleMaximize();
          }}
        >
          <div className="traffic-lights" onMouseDown={(e) => e.stopPropagation()}>
            <button className="tl-btn tl-close" onClick={() => getCurrentWindow().close()} />
            <button className="tl-btn tl-minimize" onClick={() => getCurrentWindow().minimize()} />
            <button className="tl-btn tl-maximize" onClick={() => getCurrentWindow().toggleMaximize()} />
          </div>
          <span className="logo">GlassSDR</span>
          {activeApp && (
            <button className="back-btn" onClick={handleBack}>
              <Icon name="arrowLeft" size={13} /> Home
            </button>
          )}
          {!activeApp && browseAll && (
            <button className="back-btn" onClick={() => setBrowseAll(false)}>
              <Icon name="arrowLeft" size={13} /> Dashboard
            </button>
          )}
          {activeApp && (
            <span className="top-bar__breadcrumb">
              {activeApp.replace(/_/g, " ")}
            </span>
          )}
          <div style={{ flex: 1 }} />
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            aria-label="Toggle theme"
          >
            <Icon name={theme === "dark" ? "moon" : "sun"} size={16} />
          </button>
          {!activeApp && browseAll && (
            <div className="device-selector">
              <span className={`device-indicator ${usbDevices.some(d => d.is_hackrf) ? "" : "disconnected"}`} />
              <select
                value={selectedDevice}
                onChange={(e) => setSelectedDevice(e.target.value)}
              >
                {usbDevices.length === 0 && (
                  <option value="">No devices found</option>
                )}
                {usbDevices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}{d.is_hackrf ? " ✓" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="app-content-body">
          {activeApp ? (
            renderApp()
          ) : (
            <div className="view-stack" data-view={browseAll ? "grid" : "dash"}>
              <div className="view-pane view-pane--dash">
                <DashboardApp
                  onSelectApp={setActiveApp}
                  onBrowseAll={() => setBrowseAll(true)}
                />
              </div>
              <div className="view-pane view-pane--grid">
                <AppGrid onSelectApp={(id) => { setBrowseAll(false); setActiveApp(id); }} />
              </div>
            </div>
          )}
        </div>
        <div className="version-label">Version: 1.12</div>
      </div>
    </>
  );
}
