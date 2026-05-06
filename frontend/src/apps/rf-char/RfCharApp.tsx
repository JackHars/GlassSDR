import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";

interface TxStatus {
  kind: "idle" | "armed" | "transmitting" | "complete" | "error";
  progress_pct?: number;
  message?: string;
}

const inp: React.CSSProperties = {
  background: "#222", color: "#eee", border: "1px solid #555",
  borderRadius: 3, padding: "4px 8px", width: 140,
};

const INDOOR_BANNER = (
  <div style={{
    background: "#2a1500", border: "1px solid #f80", borderRadius: 4,
    padding: "8px 12px", marginBottom: 12, color: "#fb8", fontSize: 13,
    fontWeight: 600,
  }}>
    INDOOR TEST ONLY — operate only inside a shielded enclosure.
  </div>
);

export function RfCharApp() {
  const [startHz, setStartHz] = useState(88_000_000);
  const [stopHz, setStopHz] = useState(108_000_000);
  const [stepHz, setStepHz] = useState(1_000_000);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<TxStatus | null>(null);

  useEffect(() => {
    const ul = listen<TxStatus>("tx_status", (e) => setStatus(e.payload));
    return () => { ul.then((f) => f()); };
  }, []);

  const start = () => {
    startApp("rf_characterize" as AppId, { start_hz: startHz, stop_hz: stopHz, step_hz: stepHz });
    setRunning(true);
  };
  const stop = () => { stopApp(); setRunning(false); };

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>RF Characterization</h2>
      {INDOOR_BANNER}
      <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 8, maxWidth: 420, marginBottom: 16 }}>
        <label>Start Freq (Hz):</label>
        <input type="number" value={startHz} onChange={(e) => setStartHz(Number(e.target.value))} style={inp} />
        <label>Stop Freq (Hz):</label>
        <input type="number" value={stopHz} onChange={(e) => setStopHz(Number(e.target.value))} style={inp} />
        <label>Step (Hz):</label>
        <input type="number" value={stepHz} onChange={(e) => setStepHz(Number(e.target.value))} style={inp} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={start} disabled={running}
          style={{ padding: "7px 16px", background: "#262", color: "#eee", border: "none", borderRadius: 3, cursor: "pointer" }}>
          Start Sweep
        </button>
        <button onClick={stop} disabled={!running}
          style={{ padding: "7px 16px", background: "#622", color: "#eee", border: "none", borderRadius: 3, cursor: "pointer" }}>
          Stop
        </button>
      </div>
      {status && (
        <div style={{ marginTop: 12, padding: 8, background: "#1a1a2e", borderRadius: 4, fontFamily: "monospace", fontSize: 13 }}>
          Status: <span style={{ color: "#8cf" }}>{status.kind}</span>
          {status.progress_pct !== undefined ? ` — ${status.progress_pct}%` : ""}
          {status.message ? ` — ${status.message}` : ""}
        </div>
      )}
    </div>
  );
}
