import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";

interface ErtMeterEvent {
  meter_id: number;
  meter_type: string;
  consumption: number;
}

export function ErtRxApp() {
  const [freq, setFreq] = useState(912_600_000);
  const [meters, setMeters] = useState<ErtMeterEvent[]>([]);

  const handleStart = () =>
    startApp("ert_rx" as AppId, { center_hz: freq, lna_gain_db: 32, vga_gain_db: 20, amp_enabled: false });

  useEffect(() => {
    const unlisten = listen<ErtMeterEvent>("ert_meter", (e) =>
      setMeters((prev) => [e.payload, ...prev].slice(0, 200))
    );
    return () => { unlisten.then((f) => f()); };
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <h2>ERT Meter RX</h2>
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
        <button onClick={() => setMeters([])} style={{ padding: "8px 16px", background: "#444", color: "#eee", border: "none", borderRadius: 4 }}>Clear</button>
        <span style={{ color: "#888" }}>{meters.length} readings</span>
      </div>
      <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 160px)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#1c1c2c", textAlign: "left" }}>
              <th style={{ padding: "6px 8px" }}>Meter ID</th>
              <th style={{ padding: "6px 8px" }}>Type</th>
              <th style={{ padding: "6px 8px" }}>Consumption</th>
            </tr>
          </thead>
          <tbody>
            {meters.map((m, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #222" }}>
                <td style={{ padding: "4px 8px", fontFamily: "monospace" }}>{m.meter_id}</td>
                <td style={{ padding: "4px 8px" }}>{m.meter_type}</td>
                <td style={{ padding: "4px 8px" }}>{m.consumption}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
