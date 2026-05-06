import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";

interface TpmsSensorEvent {
  sensor_id: number;
  pressure_kpa: number;
  temp_c: number;
}

const FREQS = [
  { label: "315 MHz", hz: 315_000_000 },
  { label: "433.92 MHz", hz: 433_920_000 },
];

export function TpmsRxApp() {
  const [sensors, setSensors] = useState<TpmsSensorEvent[]>([]);
  const [freqIdx, setFreqIdx] = useState(1);

  const handleStart = () =>
    startApp("tpms_rx" as AppId, {
      center_hz: FREQS[freqIdx].hz,
      lna_gain_db: 40,
      vga_gain_db: 20,
      amp_enabled: false,
    });

  useEffect(() => {
    const unlisten = listen<TpmsSensorEvent>("tpms_sensor", (e) =>
      setSensors((prev) => {
        const idx = prev.findIndex((s) => s.sensor_id === e.payload.sensor_id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = e.payload;
          return next;
        }
        return [e.payload, ...prev].slice(0, 100);
      })
    );
    return () => { unlisten.then((f) => f()); };
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <h2>TPMS Receiver</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
        <label>Frequency:</label>
        <select
          value={freqIdx}
          onChange={(e) => setFreqIdx(Number(e.target.value))}
          style={{ padding: "4px 8px", background: "#222", color: "#eee", border: "1px solid #555" }}
        >
          {FREQS.map((f, i) => (
            <option key={f.label} value={i}>{f.label}</option>
          ))}
        </select>
        <button onClick={handleStart} style={{ padding: "8px 16px", background: "#2a2", color: "#fff", border: "none", borderRadius: 4 }}>Start</button>
        <button onClick={stopApp} style={{ padding: "8px 16px", background: "#555", color: "#fff", border: "none", borderRadius: 4 }}>Stop</button>
        <button onClick={() => setSensors([])} style={{ padding: "8px 16px", background: "#444", color: "#eee", border: "none", borderRadius: 4 }}>Clear</button>
        <span style={{ color: "#888" }}>{sensors.length} sensors</span>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "#1c1c2c", textAlign: "left" }}>
            <th style={{ padding: "6px 8px" }}>Sensor ID</th>
            <th style={{ padding: "6px 8px" }}>Pressure (kPa)</th>
            <th style={{ padding: "6px 8px" }}>Temp (°C)</th>
          </tr>
        </thead>
        <tbody>
          {sensors.map((s) => (
            <tr key={s.sensor_id} style={{ borderBottom: "1px solid #222" }}>
              <td style={{ padding: "4px 8px", fontFamily: "monospace" }}>
                {s.sensor_id.toString(16).toUpperCase().padStart(8, "0")}
              </td>
              <td style={{ padding: "4px 8px" }}>{s.pressure_kpa.toFixed(1)}</td>
              <td style={{ padding: "4px 8px" }}>{s.temp_c.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
