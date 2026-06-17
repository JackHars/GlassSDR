import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";
import { RecordBar } from "../../components/RecordBar";
import { DecoderFeed } from "../../components/kit/DecoderFeed";
import type { DecoderColumn } from "../../components/kit/DecoderFeed";
import { AppScreen } from "../../components/kit/AppScreen";
import { Icon } from "../../components/kit/Icon";
import type { AppStatus } from "../../components/kit/AppScreen";
import "./EpirbRx.css";

interface EpirbBeaconEvent { hex_id: string; country_code: number; }
type Beacon = EpirbBeaconEvent & { id: number };
let _id = 0;

const COLS: DecoderColumn<Beacon>[] = [
  { key: "hex_id", label: "Hex ID", width: "200px", mono: true },
  { key: "country_code", label: "Country", width: "80px", mono: true },
];

export function EpirbRxApp() {
  const [freqHz, setFreqHz] = useState(406_028_000);
  const [beacons, setBeacons] = useState<Beacon[]>([]);
  const [lastBeacon, setLastBeacon] = useState<Beacon | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const p = listen<EpirbBeaconEvent>("epirb_beacon", (e) => {
      const b: Beacon = { ...e.payload, id: ++_id };
      setBeacons((prev) => [b, ...prev].slice(0, 200));
      setLastBeacon(b);
    });
    return () => { p.then((f) => f()); };
  }, []);

  const handleStart = async () => {
    await startApp("epirb_rx" as AppId, { center_hz: freqHz, lna_gain_db: 32, vga_gain_db: 20, amp_enabled: false });
    setRunning(true);
  };
  const handleStop = async () => { await stopApp(); setRunning(false); };

  const appStatus: AppStatus = running ? (lastBeacon ? "live" : "idle") : "idle";

  return (
    <AppScreen
      appId="epirb_rx"
      title="EPIRB Receiver"
      subtitle="406.028 MHz"
      status={appStatus}
      statusText={running ? (lastBeacon ? "BEACON DETECTED" : "Monitoring") : "Idle"}
      controls={
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "12px 16px", width: "100%" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label className="app-shell__field-label">Frequency (Hz)</label>
            <input type="number" value={freqHz} style={{ width: 130 }} onChange={(e) => setFreqHz(+e.target.value)} />
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignSelf: "flex-end" }}>
            <button className="glass-btn primary" onClick={handleStart} disabled={running}>Start</button>
            <button className="glass-btn" onClick={handleStop} disabled={!running}>Stop</button>
            <button className="glass-btn" onClick={() => { setBeacons([]); setLastBeacon(null); }}>Clear</button>
          </div>
        </div>
      }
      footer={<RecordBar appId={"epirb_rx" as Parameters<typeof RecordBar>[0]["appId"]} format="jsonl" centerHz={freqHz} />}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: "1 1 auto", minHeight: 0 }}>
        <div className="epirb-beacon-stage">
          <div className="epirb-pulse-ring">
            <div className="epirb-icon"><Icon name={lastBeacon ? "sos" : "lifebuoy"} size={32} /></div>
          </div>
          {lastBeacon ? (
            <>
              <div className="epirb-hex-id">{lastBeacon.hex_id}</div>
              <div className="epirb-country">Country {lastBeacon.country_code}</div>
            </>
          ) : (
            <div className="epirb-warning">
              Monitoring 406 MHz for EPIRB distress beacons.<br />
              Beacons indicate a genuine emergency — log and report.
            </div>
          )}
        </div>
        {beacons.length > 0 && (
          <DecoderFeed items={beacons} columns={COLS} emptyLabel="No beacons" emptyIcon="lifebuoy" />
        )}
      </div>
    </AppScreen>
  );
}
