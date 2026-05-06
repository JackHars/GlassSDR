import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";

interface ScanResultEvent {
  freq_hz: number;
  power_db: number;
}

export function LookingGlassApp() {
  const [signals, setSignals] = useState<ScanResultEvent[]>([]);

  const handleStart = () =>
    startApp("looking_glass" as AppId, {
      start_hz: 1_000_000,
      stop_hz: 6_000_000_000,
      step_hz: 1_000_000,
      lna_gain_db: 32,
      vga_gain_db: 20,
      amp_enabled: false,
    });

  useEffect(() => {
    const unlisten = listen<ScanResultEvent>("scan_result", (e) =>
      setSignals((prev) => [e.payload, ...prev].slice(0, 2000))
    );
    return () => { unlisten.then((f) => f()); };
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <h2>Looking Glass — Full Band Scan</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={handleStart} style={{ padding: "8px 16px", background: "#2a2", color: "#fff", border: "none", borderRadius: 4 }}>Start</button>
        <button onClick={stopApp} style={{ padding: "8px 16px", background: "#555", color: "#fff", border: "none", borderRadius: 4 }}>Stop</button>
        <button onClick={() => setSignals([])} style={{ padding: "8px 16px", background: "#444", color: "#eee", border: "none", borderRadius: 4 }}>Clear</button>
        <span style={{ color: "#888", alignSelf: "center" }}>{signals.length} entries</span>
      </div>
      <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 160px)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#1c1c2c", textAlign: "left" }}>
              <th style={{ padding: "6px 8px" }}>Frequency</th>
              <th style={{ padding: "6px 8px" }}>Power (dB)</th>
            </tr>
          </thead>
          <tbody>
            {signals.map((s, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #1a1a1a" }}>
                <td style={{ padding: "3px 8px", fontFamily: "monospace" }}>
                  {(s.freq_hz / 1e6).toFixed(3)} MHz
                </td>
                <td style={{ padding: "3px 8px", color: s.power_db > -60 ? "#4f4" : "#666" }}>
                  {s.power_db.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
