import { useEffect } from "react";
import { listApps } from "./ipc/commands";
import { NfmAudioApp } from "./apps/nfm-audio/NfmAudioApp";
import { AdsbRxApp } from "./apps/adsb-rx/AdsbRxApp";
import { PocsagTxApp } from "./apps/pocsag-tx/PocsagTxApp";
import { WfmRxApp } from "./apps/wfm-rx/WfmRxApp";
import { AmRxApp } from "./apps/am-rx/AmRxApp";
import { SsbRxApp } from "./apps/ssb-rx/SsbRxApp";
import { CwRxApp } from "./apps/cw-rx/CwRxApp";
import { RdsRxApp } from "./apps/rds-rx/RdsRxApp";
import { AprsRxApp } from "./apps/aprs-rx/AprsRxApp";
import { AisRxApp } from "./apps/ais-rx/AisRxApp";
import { AcarsRxApp } from "./apps/acars-rx/AcarsRxApp";
import { PocsagRxApp } from "./apps/pocsag-rx/PocsagRxApp";
import { AfskRxApp } from "./apps/afsk-rx/AfskRxApp";
import { ErtRxApp } from "./apps/ert-rx/ErtRxApp";
import { WeatherRxApp } from "./apps/weather-rx/WeatherRxApp";
import { SondeRxApp } from "./apps/sonde-rx/SondeRxApp";
import { TwoToneRxApp } from "./apps/twotone-rx/TwoToneRxApp";
import { FlexRxApp } from "./apps/flex-rx/FlexRxApp";
import { TpmsRxApp } from "./apps/tpms-rx/TpmsRxApp";
import { OokAnalyzerApp } from "./apps/ook-analyzer/OokAnalyzerApp";
import { ScannerApp } from "./apps/scanner/ScannerApp";
import { ReconApp } from "./apps/recon/ReconApp";
import { LookingGlassApp } from "./apps/looking-glass/LookingGlassApp";
import { SigGenApp } from "./apps/sig-gen/SigGenApp";
import { OokDecodersApp } from "./apps/ook-decoders/OokDecodersApp";
import { SubGhzCaptureApp } from "./apps/subghz-capture/SubGhzCaptureApp";
import { AptRxApp } from "./apps/apt-rx/AptRxApp";
import { DscRxApp } from "./apps/dsc-rx/DscRxApp";
import { EpirbRxApp } from "./apps/epirb-rx/EpirbRxApp";
import { SondeRxExtApp } from "./apps/sonde-rx-ext/SondeRxExtApp";
import { DabRxApp } from "./apps/dab-rx/DabRxApp";
import { HrptRxApp } from "./apps/hrpt-rx/HrptRxApp";
import { LrptRxApp } from "./apps/lrpt-rx/LrptRxApp";
import { AdsbExtApp } from "./apps/adsb-ext/AdsbExtApp";
import { RttyTxApp } from "./apps/rtty-tx/RttyTxApp";
import { SstvTxApp } from "./apps/sstv-tx/SstvTxApp";
import { AfskTxApp } from "./apps/afsk-tx/AfskTxApp";
import { MorseTxApp } from "./apps/morse-tx/MorseTxApp";
import { SoundboardTxApp } from "./apps/soundboard-tx/SoundboardTxApp";
import { FlexTxApp } from "./apps/flex-tx/FlexTxApp";
import { AdsbTxApp } from "./apps/adsb-tx/AdsbTxApp";
import { GpsSimApp } from "./apps/gps-sim/GpsSimApp";
import { Mdc1200TxApp } from "./apps/mdc1200-tx/Mdc1200TxApp";
import { ReplayTxApp } from "./apps/replay-tx/ReplayTxApp";
import { OokEditorTxApp } from "./apps/ook-editor-tx/OokEditorTxApp";
import { FreqHopperApp } from "./apps/freq-hopper/FreqHopperApp";
import { BtleTxApp } from "./apps/btle-tx/BtleTxApp";
import { Nrf24TxApp } from "./apps/nrf24-tx/Nrf24TxApp";
import { Rfm69TxApp } from "./apps/rfm69-tx/Rfm69TxApp";
import { FlipperTxApp } from "./apps/flipper-tx/FlipperTxApp";
import { KeyfobTxApp } from "./apps/keyfob-tx/KeyfobTxApp";
import { LgeTxApp } from "./apps/lge-tx/LgeTxApp";
import { FreqManagerApp } from "./apps/freq-manager/FreqManagerApp";
import { FileManagerApp } from "./apps/file-manager/FileManagerApp";
import { PlaylistApp } from "./apps/playlist/PlaylistApp";
import { SettingsApp } from "./apps/settings/SettingsApp";
import { CalculatorApp } from "./apps/calculator/CalculatorApp";
import { NotepadApp } from "./apps/notepad/NotepadApp";
import { SnakeApp } from "./apps/snake/SnakeApp";
import { DoomApp } from "./apps/doom/DoomApp";
import { MorseTrainerApp } from "./apps/morse-trainer/MorseTrainerApp";
import { BandPlanApp } from "./apps/band-plan/BandPlanApp";
import { AntennaCalcApp } from "./apps/antenna-calc/AntennaCalcApp";
import { SignalMeterApp } from "./apps/signal-meter/SignalMeterApp";
import { BtleRxApp } from "./apps/btle-rx/BtleRxApp";
import { BtleCommApp } from "./apps/btle-comm/BtleCommApp";
import { Nrf24RxApp } from "./apps/nrf24-rx/Nrf24RxApp";
import { EncoderSuiteApp } from "./apps/encoder-suite/EncoderSuiteApp";
import { DecoderSuiteApp } from "./apps/decoder-suite/DecoderSuiteApp";
import { CaptureManagerApp } from "./apps/capture-manager/CaptureManagerApp";
import { SpectrumPainterApp } from "./apps/spectrum-painter/SpectrumPainterApp";
import { RfCharApp } from "./apps/rf-char/RfCharApp";
import { ProtocolAnalyzerApp } from "./apps/protocol-analyzer/ProtocolAnalyzerApp";
import { RemoteControlApp } from "./apps/remote-control/RemoteControlApp";
import { IqPlayerApp } from "./apps/iq-player/IqPlayerApp";
import { SdrBenchApp } from "./apps/sdr-bench/SdrBenchApp";
import { FreqCounterApp } from "./apps/freq-counter/FreqCounterApp";
import { CtcssDcsApp } from "./apps/ctcss-dcs/CtcssDcsApp";
import { DmrRxApp } from "./apps/dmr-rx/DmrRxApp";
import { DpmrRxApp } from "./apps/dpmr-rx/DpmrRxApp";
import { P25RxApp } from "./apps/p25-rx/P25RxApp";
import { NxdnRxApp } from "./apps/nxdn-rx/NxdnRxApp";
import { TetraRxApp } from "./apps/tetra-rx/TetraRxApp";
import { PagerAggApp } from "./apps/pager-agg/PagerAggApp";
import { useStore } from "./store";

export default function App() {
  const apps = useStore((s) => s.apps);
  const setApps = useStore((s) => s.setApps);
  const activeApp = useStore((s) => s.activeApp);
  const setActiveApp = useStore((s) => s.setActiveApp);

  useEffect(() => {
    listApps().then((a) => {
      setApps(a);
      if (a.length > 0 && activeApp === null) setActiveApp(a[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setApps, setActiveApp]);

  return (
    <div style={{ display: "flex", height: "100vh", color: "#eee", background: "#111" }}>
      <nav style={{ width: 200, padding: 8, background: "#1c1c2c", overflowY: "auto" }}>
        <h3 style={{ margin: "0 0 8px" }}>Apps</h3>
        {apps.map((a) => (
          <button
            key={a.id}
            onClick={() => setActiveApp(a.id)}
            style={{
              display: "block",
              width: "100%",
              padding: 6,
              marginBottom: 4,
              background: a.id === activeApp ? "#444" : "transparent",
              color: "#eee",
              border: "1px solid #333",
            }}
          >
            {a.name}
          </button>
        ))}
        <h3 style={{ margin: "16px 0 8px", color: "#888", fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>RF Tools</h3>
        {([
          ["signal_meter", "Signal Meter"],
          ["band_plan", "Band Plan"],
          ["antenna_calc", "Antenna Calc"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setActiveApp(id as any)}
            style={{
              display: "block",
              width: "100%",
              padding: 6,
              marginBottom: 4,
              background: activeApp === id ? "#444" : "transparent",
              color: "#eee",
              border: "1px solid #333",
            }}
          >
            {label}
          </button>
        ))}
        <h3 style={{ margin: "16px 0 8px", color: "#888", fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>Games</h3>
        {([
          ["snake", "Snake"],
          ["doom", "Doom"],
          ["morse_trainer", "Morse Trainer"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setActiveApp(id as any)}
            style={{
              display: "block",
              width: "100%",
              padding: 6,
              marginBottom: 4,
              background: activeApp === id ? "#444" : "transparent",
              color: "#eee",
              border: "1px solid #333",
            }}
          >
            {label}
          </button>
        ))}
        <h3 style={{ margin: "16px 0 8px", color: "#888", fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>Utilities</h3>
        {([
          ["freq_manager", "Freq Manager"],
          ["file_manager", "File Manager"],
          ["playlist", "Playlist"],
          ["settings", "Settings"],
          ["calculator", "Calculator"],
          ["notepad", "Notepad"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setActiveApp(id as any)}
            style={{
              display: "block",
              width: "100%",
              padding: 6,
              marginBottom: 4,
              background: activeApp === id ? "#444" : "transparent",
              color: "#eee",
              border: "1px solid #333",
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      <main style={{ flex: 1, padding: 8, overflow: "auto" }}>
        {activeApp === "nfm_audio" && <NfmAudioApp />}
        {activeApp === "adsb_rx" && <AdsbRxApp />}
        {activeApp === "pocsag_tx" && <PocsagTxApp />}
        {activeApp === "wfm_rx" && <WfmRxApp />}
        {activeApp === "am_rx" && <AmRxApp />}
        {activeApp === "usb_rx" && <SsbRxApp appId="usb_rx" label="USB Receiver" />}
        {activeApp === "lsb_rx" && <SsbRxApp appId="lsb_rx" label="LSB Receiver" />}
        {activeApp === "cw_rx" && <CwRxApp />}
        {activeApp === "rds_rx" && <RdsRxApp />}
        {activeApp === "aprs_rx" && <AprsRxApp />}
        {activeApp === "ais_rx" && <AisRxApp />}
        {activeApp === "acars_rx" && <AcarsRxApp />}
        {activeApp === "pocsag_rx" && <PocsagRxApp />}
        {activeApp === "afsk_rx" && <AfskRxApp />}
        {activeApp === "ert_rx" && <ErtRxApp />}
        {activeApp === "weather_rx" && <WeatherRxApp />}
        {activeApp === "sonde_rx" && <SondeRxApp />}
        {activeApp === "two_tone_rx" && <TwoToneRxApp />}
        {activeApp === "flex_rx" && <FlexRxApp />}
        {activeApp === "tpms_rx" && <TpmsRxApp />}
        {activeApp === "ook_analyzer" && <OokAnalyzerApp />}
        {activeApp === "scanner" && <ScannerApp />}
        {activeApp === "recon" && <ReconApp />}
        {activeApp === "looking_glass" && <LookingGlassApp />}
        {activeApp === "sig_gen" && <SigGenApp />}
        {activeApp === "ook_decoders" && <OokDecodersApp />}
        {activeApp === "sub_ghz_capture" && <SubGhzCaptureApp />}
        {activeApp === "apt_rx" && <AptRxApp />}
        {activeApp === "dsc_rx" && <DscRxApp />}
        {activeApp === "epirb_rx" && <EpirbRxApp />}
        {activeApp === "sonde_rx_ext" && <SondeRxExtApp />}
        {activeApp === "dab_rx" && <DabRxApp />}
        {activeApp === "hrpt_rx" && <HrptRxApp />}
        {activeApp === "lrpt_rx" && <LrptRxApp />}
        {activeApp === "adsb_rx_ext" && <AdsbExtApp />}
        {activeApp === "rtty_tx" && <RttyTxApp />}
        {activeApp === "sstv_tx" && <SstvTxApp />}
        {activeApp === "afsk_tx" && <AfskTxApp />}
        {activeApp === "morse_tx" && <MorseTxApp />}
        {activeApp === "soundboard_tx" && <SoundboardTxApp />}
        {activeApp === "flex_tx" && <FlexTxApp />}
        {activeApp === "adsb_tx" && <AdsbTxApp />}
        {activeApp === "gps_sim" && <GpsSimApp />}
        {activeApp === "mdc1200_tx" && <Mdc1200TxApp />}
        {activeApp === "replay_tx" && <ReplayTxApp />}
        {activeApp === "ook_editor_tx" && <OokEditorTxApp />}
        {activeApp === "freq_hopper" && <FreqHopperApp />}
        {activeApp === "btle_tx" && <BtleTxApp />}
        {activeApp === "nrf24_tx" && <Nrf24TxApp />}
        {activeApp === "rfm69_tx" && <Rfm69TxApp />}
        {activeApp === "flipper_tx" && <FlipperTxApp />}
        {activeApp === "keyfob_tx" && <KeyfobTxApp />}
        {activeApp === "lge_tx" && <LgeTxApp />}
        {activeApp === "freq_manager" && <FreqManagerApp />}
        {activeApp === "file_manager" && <FileManagerApp />}
        {activeApp === "playlist" && <PlaylistApp />}
        {activeApp === "settings" && <SettingsApp />}
        {activeApp === "calculator" && <CalculatorApp />}
        {activeApp === "notepad" && <NotepadApp />}
        {activeApp === "snake" && <SnakeApp />}
        {activeApp === "doom" && <DoomApp />}
        {activeApp === "morse_trainer" && <MorseTrainerApp />}
        {activeApp === "band_plan" && <BandPlanApp />}
        {activeApp === "antenna_calc" && <AntennaCalcApp />}
        {activeApp === "signal_meter" && <SignalMeterApp />}
        {activeApp === "btle_rx" && <BtleRxApp />}
        {activeApp === "btle_comm" && <BtleCommApp />}
        {activeApp === "nrf24_rx" && <Nrf24RxApp />}
        {activeApp === "encoder_suite" && <EncoderSuiteApp />}
        {activeApp === "decoder_suite" && <DecoderSuiteApp />}
        {activeApp === "capture_manager" && <CaptureManagerApp />}
        {activeApp === "spectrum_painter" && <SpectrumPainterApp />}
        {activeApp === "rf_characterize" && <RfCharApp />}
        {activeApp === "protocol_analyzer" && <ProtocolAnalyzerApp />}
        {activeApp === "remote_control" && <RemoteControlApp />}
        {activeApp === "iq_player" && <IqPlayerApp />}
        {activeApp === "sdr_benchmark" && <SdrBenchApp />}
        {activeApp === "freq_counter" && <FreqCounterApp />}
        {activeApp === "ctcss_dcs" && <CtcssDcsApp />}
        {activeApp === "dmr_rx" && <DmrRxApp />}
        {activeApp === "dpmr_rx" && <DpmrRxApp />}
        {activeApp === "p25_rx" && <P25RxApp />}
        {activeApp === "nxdn_rx" && <NxdnRxApp />}
        {activeApp === "tetra_rx" && <TetraRxApp />}
        {activeApp === "pager_aggregator" && <PagerAggApp />}
      </main>
    </div>
  );
}
