import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";

interface ScanResultEvent {
  freq_hz: number;
  power_db: number;
}

export function ScannerApp() {
  const [signals, setSignals] = useState<ScanResultEvent[]>([]);
  const [startHz, setStartHz] = useState(400_000_000);
  const [stopHz, setStopHz] = useState(500_000_000);
  const [stepHz, setStepHz] = useState(25_000);

  const handleStart = () =>
    startApp("scanner" as AppId, {
      start_hz: startHz,
      stop_hz: stopHz,
      step_hz: stepHz,
      lna_gain_db: 32,
      vga_gain_db: 20,
      amp_enabled: false,
    });

  useEffect(() => {
    const unlisten = listen<ScanResultEvent>("scan_result", (e) =>
      setSignals((prev) => [e.payload, ...prev].slice(0, 500))
    );
    return () => { unlisten.then((f) => f()); };
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <h2>Scanner</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
        <label>Start (Hz):</label>
        <input
          type="number"
          value={startHz}
          onChange={(e) => setStartHz(Number(e.target.value))}
          style={{ width: 130, padding: "4px 8px", background: "#222", color: "#eee", border: "1px solid #555" }}
        />
        <label>Stop (Hz):</label>
        <input
          type="number"
          value={stopHz}
          onChange={(e) => setStopHz(Number(e.target.value))}
          style={{ width: 130, padding: "4px 8px", background: "#222", color: "#eee", border: "1px solid #555" }}
        />
        <label>Step (Hz):</label>
        <input
          type="number"
          value={stepHz}
          onChange={(e) => setStepHz(Number(e.target.value))}
          style={{ width: 100, padding: "4px 8px", background: "#222", color: "#eee", border: "1px solid #555" }}
        />
        <button onClick={handleStart} style={{ padding: "8px 16px", background: "#2a2", color: "#fff", border: "none", borderRadius: 4 }}>Start</button>
        <button onClick={stopApp} style={{ padding: "8px 16px", background: "#555", color: "#fff", border: "none", borderRadius: 4 }}>Stop</button>
        <button onClick={() => setSignals([])} style={{ padding: "8px 16px", background: "#444", color: "#eee", border: "none", borderRadius: 4 }}>Clear</button>
        <span style={{ color: "#888" }}>{signals.length} hits</span>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "#1c1c2c", textAlign: "left" }}>
            <th style={{ padding: "6px 8px" }}>Frequency</th>
            <th style={{ padding: "6px 8px" }}>Power (dB)</th>
          </tr>
        </thead>
        <tbody>
          {signals.map((s, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #222" }}>
              <td style={{ padding: "4px 8px", fontFamily: "monospace" }}>
                {(s.freq_hz / 1e6).toFixed(4)} MHz
              </td>
              <td style={{ padding: "4px 8px", color: s.power_db > -60 ? "#4f4" : "#888" }}>
                {s.power_db.toFixed(1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
