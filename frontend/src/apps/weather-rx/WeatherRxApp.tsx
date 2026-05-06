import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";

interface WeatherEvent {
  sensor_id: number;
  channel: number;
  temp_c: number | null;
  humidity: number | null;
}

export function WeatherRxApp() {
  const [freq, setFreq] = useState(433_920_000);
  const [readings, setReadings] = useState<WeatherEvent[]>([]);

  const handleStart = () =>
    startApp("weather_rx" as AppId, { center_hz: freq, lna_gain_db: 32, vga_gain_db: 20, amp_enabled: false });

  useEffect(() => {
    const unlisten = listen<WeatherEvent>("weather_reading", (e) =>
      setReadings((prev) => [e.payload, ...prev].slice(0, 200))
    );
    return () => { unlisten.then((f) => f()); };
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <h2>Weather Station RX</h2>
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
        <button onClick={() => setReadings([])} style={{ padding: "8px 16px", background: "#444", color: "#eee", border: "none", borderRadius: 4 }}>Clear</button>
        <span style={{ color: "#888" }}>{readings.length} readings</span>
      </div>
      <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 160px)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#1c1c2c", textAlign: "left" }}>
              <th style={{ padding: "6px 8px" }}>Sensor ID</th>
              <th style={{ padding: "6px 8px" }}>Ch</th>
              <th style={{ padding: "6px 8px" }}>Temp (°C)</th>
              <th style={{ padding: "6px 8px" }}>Humidity (%)</th>
            </tr>
          </thead>
          <tbody>
            {readings.map((r, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #222" }}>
                <td style={{ padding: "4px 8px", fontFamily: "monospace" }}>{r.sensor_id}</td>
                <td style={{ padding: "4px 8px" }}>{r.channel}</td>
                <td style={{ padding: "4px 8px" }}>{r.temp_c != null ? r.temp_c.toFixed(1) : "—"}</td>
                <td style={{ padding: "4px 8px" }}>{r.humidity != null ? r.humidity : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
