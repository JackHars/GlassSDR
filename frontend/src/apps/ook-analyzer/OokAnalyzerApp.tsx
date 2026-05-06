import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";

interface PulseEventIpc {
  is_high: boolean;
  duration_us: number;
}

export function OokAnalyzerApp() {
  const [pulses, setPulses] = useState<PulseEventIpc[]>([]);
  const [freqHz, setFreqHz] = useState(433_920_000);

  const handleStart = () =>
    startApp("ook_analyzer" as AppId, {
      center_hz: freqHz,
      lna_gain_db: 40,
      vga_gain_db: 20,
      amp_enabled: false,
    });

  useEffect(() => {
    const unlisten = listen<PulseEventIpc>("pulse_event", (e) =>
      setPulses((prev) => [e.payload, ...prev].slice(0, 500))
    );
    return () => { unlisten.then((f) => f()); };
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <h2>OOK Analyzer</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
        <label>Freq (Hz):</label>
        <input
          type="number"
          value={freqHz}
          onChange={(e) => setFreqHz(Number(e.target.value))}
          style={{ width: 140, padding: "4px 8px", background: "#222", color: "#eee", border: "1px solid #555" }}
        />
        <button onClick={handleStart} style={{ padding: "8px 16px", background: "#2a2", color: "#fff", border: "none", borderRadius: 4 }}>Start</button>
        <button onClick={stopApp} style={{ padding: "8px 16px", background: "#555", color: "#fff", border: "none", borderRadius: 4 }}>Stop</button>
        <button onClick={() => setPulses([])} style={{ padding: "8px 16px", background: "#444", color: "#eee", border: "none", borderRadius: 4 }}>Clear</button>
        <span style={{ color: "#888" }}>{pulses.length} pulses</span>
      </div>
      <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 160px)", fontFamily: "monospace", fontSize: 12 }}>
        {pulses.map((p, i) => (
          <div
            key={i}
            style={{
              padding: "2px 8px",
              background: p.is_high ? "#1a3a1a" : "#1c1c2c",
              borderBottom: "1px solid #222",
            }}
          >
            <span style={{ color: p.is_high ? "#4f4" : "#888", marginRight: 12 }}>
              {p.is_high ? "HIGH" : "LOW "}
            </span>
            {p.duration_us.toFixed(1)} µs
          </div>
        ))}
      </div>
    </div>
  );
}
