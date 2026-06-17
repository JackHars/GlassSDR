import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";
import { RecordBar } from "../../components/RecordBar";
import { AppScreen } from "../../components/kit/AppScreen";
import type { AppStatus } from "../../components/kit/AppScreen";
import "./TpmsRx.css";

interface TpmsSensorEvent { sensor_id: number; pressure_kpa: number; temp_c: number; }

const FREQS = [
  { label: "315 MHz", hz: 315_000_000 },
  { label: "433.92 MHz", hz: 433_920_000 },
];
const NOMINAL_KPA = 220;

export function TpmsRxApp() {
  const [sensors, setSensors] = useState<TpmsSensorEvent[]>([]);
  const [freqIdx, setFreqIdx] = useState(1);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const p = listen<TpmsSensorEvent>("tpms_sensor", (e) =>
      setSensors((prev) => {
        const idx = prev.findIndex((s) => s.sensor_id === e.payload.sensor_id);
        if (idx >= 0) { const next = [...prev]; next[idx] = e.payload; return next; }
        return [e.payload, ...prev].slice(0, 100);
      })
    );
    return () => { p.then((f) => f()); };
  }, []);

  const handleStart = async () => {
    await startApp("tpms_rx" as AppId, { center_hz: FREQS[freqIdx].hz, lna_gain_db: 40, vga_gain_db: 20, amp_enabled: false });
    setRunning(true);
  };
  const handleStop = async () => { await stopApp(); setRunning(false); };

  const appStatus: AppStatus = running ? (sensors.length > 0 ? "live" : "acquiring") : "idle";

  return (
    <AppScreen
      appId="tpms_rx"
      title="TPMS Receiver"
      subtitle={FREQS[freqIdx].label}
      status={appStatus}
      statusText={running ? (sensors.length > 0 ? `${sensors.length} sensors` : "Listening") : "Idle"}
      controls={
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "12px 16px", width: "100%" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label className="app-shell__field-label">Frequency</label>
            <select value={freqIdx} onChange={(e) => setFreqIdx(+e.target.value)}>
              {FREQS.map((f, i) => <option key={f.label} value={i}>{f.label}</option>)}
            </select>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignSelf: "flex-end" }}>
            <button className="glass-btn primary" onClick={handleStart} disabled={running}>Start</button>
            <button className="glass-btn" onClick={handleStop} disabled={!running}>Stop</button>
            <button className="glass-btn" onClick={() => setSensors([])}>Clear</button>
          </div>
        </div>
      }
      footer={<RecordBar appId={"tpms_rx" as Parameters<typeof RecordBar>[0]["appId"]} format="jsonl" centerHz={FREQS[freqIdx].hz} />}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: "1 1 auto", minHeight: 0 }}>
        <div className="tpms-stats">
          <div className="tpms-stat"><span className="tpms-stat-label">Sensors</span><span className="tpms-stat-value">{sensors.length}</span></div>
        </div>
        {sensors.length === 0 ? (
          <div style={{ flex: "1 1 auto", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)", fontSize: 13, fontStyle: "italic" }}>
            No TPMS sensors — be near moving vehicles
          </div>
        ) : (
          <div className="tpms-grid" style={{ overflowY: "auto", flex: "1 1 auto" }}>
            {sensors.map((s) => {
              const pct = Math.min(100, (s.pressure_kpa / (NOMINAL_KPA * 1.3)) * 100);
              return (
                <div key={s.sensor_id} className="tpms-sensor-card">
                  <div className="tpms-sensor-id">{s.sensor_id.toString(16).toUpperCase().padStart(8, "0")}</div>
                  <div className="tpms-pressure">{s.pressure_kpa.toFixed(1)}<span className="tpms-unit">kPa</span></div>
                  <div className="tpms-temp">{s.temp_c.toFixed(1)}<span className="tpms-unit">°C</span></div>
                  <div className="tpms-pressure-bar">
                    <div className="tpms-pressure-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppScreen>
  );
}
