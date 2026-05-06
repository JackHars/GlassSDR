import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";

interface SondeEvent {
  serial: string;
  lat: number;
  lon: number;
  alt_m: number;
  sonde_type: string;
}

export function SondeRxApp() {
  const [freq, setFreq] = useState(403_000_000);
  const [frames, setFrames] = useState<SondeEvent[]>([]);

  const handleStart = () =>
    startApp("sonde_rx" as AppId, { center_hz: freq, lna_gain_db: 32, vga_gain_db: 20, amp_enabled: false });

  useEffect(() => {
    const unlisten = listen<SondeEvent>("sonde_telemetry", (e) =>
      setFrames((prev) => [e.payload, ...prev].slice(0, 200))
    );
    return () => { unlisten.then((f) => f()); };
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <h2>Radiosonde RX</h2>
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
        <button onClick={() => setFrames([])} style={{ padding: "8px 16px", background: "#444", color: "#eee", border: "none", borderRadius: 4 }}>Clear</button>
        <span style={{ color: "#888" }}>{frames.length} frames</span>
      </div>
      <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 160px)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#1c1c2c", textAlign: "left" }}>
              <th style={{ padding: "6px 8px" }}>Serial</th>
              <th style={{ padding: "6px 8px" }}>Type</th>
              <th style={{ padding: "6px 8px" }}>Lat</th>
              <th style={{ padding: "6px 8px" }}>Lon</th>
              <th style={{ padding: "6px 8px" }}>Alt (m)</th>
            </tr>
          </thead>
          <tbody>
            {frames.map((f, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #222" }}>
                <td style={{ padding: "4px 8px", fontFamily: "monospace" }}>{f.serial}</td>
                <td style={{ padding: "4px 8px" }}>{f.sonde_type}</td>
                <td style={{ padding: "4px 8px" }}>{f.lat.toFixed(5)}</td>
                <td style={{ padding: "4px 8px" }}>{f.lon.toFixed(5)}</td>
                <td style={{ padding: "4px 8px" }}>{f.alt_m.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
