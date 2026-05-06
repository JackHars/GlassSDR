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
      <nav style={{ width: 200, padding: 8, background: "#1c1c2c" }}>
        <h3>Apps</h3>
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
      </main>
    </div>
  );
}
