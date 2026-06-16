import { useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";
import { RecordBar } from "../../components/RecordBar";
import { AppScreen } from "../../components/kit/AppScreen";
import type { AppStatus } from "../../components/kit/AppScreen";
import "./DabRx.css";

interface DabServiceEvent { eid: number; ensemble_label: string; }
type Service = DabServiceEvent & { id: number };
let _id = 0;

export function DabRxApp() {
  const [freqHz, setFreqHz] = useState(220_352_000);
  const [services, setServices] = useState<Service[]>([]);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const p = listen<DabServiceEvent>("dab_service", (e) =>
      setServices((prev) => [{ ...e.payload, id: ++_id }, ...prev].slice(0, 200))
    );
    return () => { p.then((f) => f()); };
  }, []);

  const handleStart = async () => {
    await startApp("dab_rx" as AppId, { center_hz: freqHz, lna_gain_db: 32, vga_gain_db: 20, amp_enabled: false });
    setRunning(true);
  };
  const handleStop = async () => { await stopApp(); setRunning(false); };

  const uniqueEnsembles = useMemo(() => {
    const m = new Map<number, Service>();
    for (const s of services) { if (!m.has(s.eid)) m.set(s.eid, s); }
    return Array.from(m.values());
  }, [services]);

  const appStatus: AppStatus = running ? (services.length > 0 ? "live" : "acquiring") : "idle";

  return (
    <AppScreen
      appId="dab_rx"
      title="DAB Receiver"
      subtitle={`${(freqHz / 1e6).toFixed(3)} MHz · Band III`}
      status={appStatus}
      statusText={running ? (services.length > 0 ? `${uniqueEnsembles.length} ensembles` : "Scanning") : "Idle"}
      controls={
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "12px 16px", width: "100%" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label className="app-shell__field-label">Frequency (Hz)</label>
            <input type="number" value={freqHz} style={{ width: 130 }} onChange={(e) => setFreqHz(+e.target.value)} />
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignSelf: "flex-end" }}>
            <button className="glass-btn primary" onClick={handleStart} disabled={running}>Start</button>
            <button className="glass-btn" onClick={handleStop} disabled={!running}>Stop</button>
            <button className="glass-btn" onClick={() => setServices([])}>Clear</button>
          </div>
        </div>
      }
      footer={<RecordBar appId={"dab_rx" as Parameters<typeof RecordBar>[0]["appId"]} format="jsonl" centerHz={freqHz} />}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: "1 1 auto", minHeight: 0 }}>
        <div className="dab-stats">
          <div className="dab-stat"><span className="dab-stat-label">Ensembles</span><span className="dab-stat-value">{uniqueEnsembles.length}</span></div>
        </div>
        {uniqueEnsembles.length === 0 ? (
          <div style={{ flex: "1 1 auto", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)", fontSize: 13, fontStyle: "italic" }}>
            No DAB ensembles — Band III 174–240 MHz
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10, overflowY: "auto", flex: "1 1 auto" }}>
            {uniqueEnsembles.map((s) => (
              <div key={s.eid} className="dab-ensemble-card">
                <div className="dab-eid">EID {s.eid.toString(16).toUpperCase().padStart(4, "0")}</div>
                <div className="dab-label">{s.ensemble_label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppScreen>
  );
}
