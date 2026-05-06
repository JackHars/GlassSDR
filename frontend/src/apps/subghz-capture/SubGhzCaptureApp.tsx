import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";

interface PulseEventIpc {
  is_high: boolean;
  duration_us: number;
}

export function SubGhzCaptureApp() {
  const [pulses, setPulses] = useState<PulseEventIpc[]>([]);
  const [freqHz, setFreqHz] = useState(433_920_000);

  const handleStart = () =>
    startApp("sub_ghz_capture" as AppId, {
      center_hz: freqHz,
      lna_gain_db: 40,
      vga_gain_db: 20,
      amp_enabled: false,
    });

  useEffect(() => {
    const unlisten = listen<PulseEventIpc>("pulse_event", (e) =>
      setPulses((prev) => [e.payload, ...prev].slice(0, 1000))
    );
    return () => { unlisten.then((f) => f()); };
  }, []);

  const totalDuration = pulses.reduce((acc, p) => acc + p.duration_us, 0);

  return (
    <div style={{ padding: 16 }}>
      <h2>Sub-GHz Capture</h2>
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
        <span style={{ color: "#888" }}>
          {pulses.length} pulses — {(totalDuration / 1000).toFixed(2)} ms total
        </span>
      </div>
      <div
        style={{
          overflowY: "auto",
          maxHeight: "calc(100vh - 160px)",
          fontFamily: "monospace",
          fontSize: 12,
        }}
      >
        {pulses.map((p, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "2px 8px",
              borderBottom: "1px solid #1a1a1a",
            }}
          >
            <span style={{ color: p.is_high ? "#4f4" : "#888", width: 36 }}>
              {p.is_high ? "HIGH" : "LOW"}
            </span>
            <span style={{ width: 80, textAlign: "right" }}>{p.duration_us.toFixed(1)} µs</span>
            <div
              style={{
                flex: 1,
                height: 6,
                background: p.is_high ? "#2a6" : "#444",
                maxWidth: Math.min(400, p.duration_us * 0.2),
                borderRadius: 1,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
