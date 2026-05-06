import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";

interface FreqMeasureEvent { frequency_hz: number; precision_hz: number; }

type GateTime = 100 | 1000 | 10000;

const inp: React.CSSProperties = {
  background: "#222", color: "#eee", border: "1px solid #555",
  borderRadius: 3, padding: "4px 8px", width: 140,
};

function formatHz(hz: number): string {
  if (hz >= 1e9) return `${(hz / 1e9).toFixed(6)} GHz`;
  if (hz >= 1e6) return `${(hz / 1e6).toFixed(6)} MHz`;
  if (hz >= 1e3) return `${(hz / 1e3).toFixed(3)} kHz`;
  return `${hz.toFixed(1)} Hz`;
}

export function FreqCounterApp() {
  const [centerHz, setCenterHz] = useState(100_000_000);
  const [gateMs, setGateMs] = useState<GateTime>(1000);
  const [running, setRunning] = useState(false);
  const [measured, setMeasured] = useState<FreqMeasureEvent | null>(null);

  useEffect(() => {
    const ul = listen<FreqMeasureEvent>("freq_measure", (e) => setMeasured(e.payload));
    return () => { ul.then((f) => f()); };
  }, []);

  const start = () => {
    startApp("freq_counter" as AppId, { center_hz: centerHz, gate_ms: gateMs });
    setRunning(true);
  };
  const stop = () => { stopApp(); setRunning(false); };

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>Frequency Counter</h2>
      <p style={{ color: "#aaa", fontSize: 13 }}>
        High-precision frequency measurement via zero-crossing analysis.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 8, maxWidth: 420, marginBottom: 16 }}>
        <label>Center Freq (Hz):</label>
        <input type="number" value={centerHz} onChange={(e) => setCenterHz(Number(e.target.value))} style={inp} />
        <label>Gate Time:</label>
        <select value={gateMs} onChange={(e) => setGateMs(Number(e.target.value) as GateTime)} style={inp}>
          <option value={100}>100 ms</option>
          <option value={1000}>1 s</option>
          <option value={10000}>10 s</option>
        </select>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button onClick={start} disabled={running}
          style={{ padding: "7px 16px", background: "#262", color: "#eee", border: "none", borderRadius: 3, cursor: "pointer" }}>
          Start
        </button>
        <button onClick={stop} disabled={!running}
          style={{ padding: "7px 16px", background: "#622", color: "#eee", border: "none", borderRadius: 3, cursor: "pointer" }}>
          Stop
        </button>
      </div>
      <div style={{
        fontSize: 44, fontFamily: "monospace", letterSpacing: 2,
        color: measured ? "#8cf" : "#333",
        background: "#0d0d1a", borderRadius: 6, padding: "16px 24px",
        display: "inline-block", minWidth: 320, textAlign: "center",
      }}>
        {measured ? formatHz(measured.frequency_hz) : "—"}
      </div>
      {measured && (
        <div style={{ marginTop: 8, color: "#666", fontSize: 12 }}>
          Precision: ±{measured.precision_hz.toFixed(1)} Hz
        </div>
      )}
    </div>
  );
}
