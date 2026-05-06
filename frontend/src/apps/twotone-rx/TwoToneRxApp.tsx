import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";

interface TwoToneEvent {
  tone_a_hz: number;
  tone_b_hz: number;
  timestamp_ms: number;
}

export function TwoToneRxApp() {
  const [freq, setFreq] = useState(154_400_000);
  const [alerts, setAlerts] = useState<TwoToneEvent[]>([]);

  const handleStart = () =>
    startApp("two_tone_rx" as AppId, { center_hz: freq, lna_gain_db: 32, vga_gain_db: 20, amp_enabled: false });

  useEffect(() => {
    const unlisten = listen<TwoToneEvent>("two_tone_alert", (e) =>
      setAlerts((prev) => [e.payload, ...prev].slice(0, 200))
    );
    return () => { unlisten.then((f) => f()); };
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <h2>Two-Tone Pager RX</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
        <label>Freq (Hz):</label>
        <input
          type="number"
          value={freq}
          onChange={(e) => setFreq(Number(e.target.value))}
          style={{ width: 140, padding: "4px 8px", background: "#222", color: "#eee", border: "1px solid #444" }}
        />
        <button onClick={handleStart} style={{ padding: "8px 16px", background: "#2a2", color: "#fff", border: "none", borderRadius: 4 }}>Start</button>
        <button onClick={stopApp} style={{ padding: "8px 16px", background: "#555", color: "#fff", border: "none", borderRadius: 4 }}>Stop</button>
        <button onClick={() => setAlerts([])} style={{ padding: "8px 16px", background: "#444", color: "#eee", border: "none", borderRadius: 4 }}>Clear</button>
        <span style={{ color: "#888" }}>{alerts.length} alerts</span>
      </div>
      <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 160px)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#1c1c2c", textAlign: "left" }}>
              <th style={{ padding: "6px 8px" }}>Tone A (Hz)</th>
              <th style={{ padding: "6px 8px" }}>Tone B (Hz)</th>
              <th style={{ padding: "6px 8px" }}>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((a, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #222" }}>
                <td style={{ padding: "4px 8px" }}>{a.tone_a_hz.toFixed(1)}</td>
                <td style={{ padding: "4px 8px" }}>{a.tone_b_hz.toFixed(1)}</td>
                <td style={{ padding: "4px 8px", fontFamily: "monospace" }}>
                  {new Date(a.timestamp_ms).toISOString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
