import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";

interface CtcssDetectEvent { tone_hz: number; power_db: number; }

const inp: React.CSSProperties = {
  background: "#222", color: "#eee", border: "1px solid #555",
  borderRadius: 3, padding: "4px 8px", width: 140,
};

const KNOWN_TONES = [
  67.0, 71.9, 74.4, 77.0, 79.7, 82.5, 85.4, 88.5, 91.5, 94.8,
  97.4, 100.0, 103.5, 107.2, 110.9, 114.8, 118.8, 123.0, 127.3, 131.8,
  136.5, 141.3, 146.2, 151.4, 156.7, 162.2, 167.9, 173.8, 179.9, 186.2,
  192.8, 203.5, 210.7, 218.1, 225.7, 233.6, 241.8, 250.3,
];

function nearestTone(hz: number): string {
  const closest = KNOWN_TONES.reduce((a, b) => Math.abs(b - hz) < Math.abs(a - hz) ? b : a);
  return Math.abs(closest - hz) < 1.0 ? `${closest.toFixed(1)} Hz` : `${hz.toFixed(1)} Hz (unknown)`;
}

export function CtcssDcsApp() {
  const [centerHz, setCenterHz] = useState(146_520_000);
  const [running, setRunning] = useState(false);
  const [detected, setDetected] = useState<CtcssDetectEvent | null>(null);

  useEffect(() => {
    const ul = listen<CtcssDetectEvent>("ctcss_detect", (e) => {
      if (e.payload.tone_hz > 0) setDetected(e.payload);
    });
    return () => { ul.then((f) => f()); };
  }, []);

  const start = () => {
    setDetected(null);
    startApp("ctcss_dcs" as AppId, { center_hz: centerHz });
    setRunning(true);
  };
  const stop = () => { stopApp(); setRunning(false); };

  const hasSignal = detected && detected.tone_hz > 0;

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>CTCSS/DCS Decoder</h2>
      <p style={{ color: "#aaa", fontSize: 13 }}>
        Detects sub-audible CTCSS tones (67–250.3 Hz) used in FM repeater squelch.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 8, maxWidth: 420, marginBottom: 16 }}>
        <label>Frequency (Hz):</label>
        <input type="number" value={centerHz} onChange={(e) => setCenterHz(Number(e.target.value))} style={inp} />
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button onClick={start} disabled={running}
          style={{ padding: "7px 16px", background: "#262", color: "#eee", border: "none", borderRadius: 3, cursor: "pointer" }}>
          Start
        </button>
        <button onClick={stop} disabled={!running}
          style={{ padding: "7px 16px", background: "#622", color: "#eee", border: "none", borderRadius: 3, cursor: "pointer" }}>
          Stop
        </button>
      </div>

      <div style={{
        background: "#0d0d1a", borderRadius: 6, padding: "20px 24px",
        display: "inline-flex", flexDirection: "column", gap: 8, minWidth: 300,
      }}>
        <div style={{ fontSize: 12, color: "#555", textTransform: "uppercase", letterSpacing: 1 }}>Detected Tone</div>
        <div style={{ fontSize: 42, fontFamily: "monospace", color: hasSignal ? "#4fc" : "#333" }}>
          {hasSignal ? nearestTone(detected!.tone_hz) : "—"}
        </div>
        {hasSignal && (
          <div style={{ fontSize: 12, color: "#668" }}>
            Power: {detected!.power_db.toFixed(1)} dB
          </div>
        )}
        {!hasSignal && running && (
          <div style={{ fontSize: 13, color: "#555" }}>Listening…</div>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>Standard CTCSS Tones</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {KNOWN_TONES.map((t) => (
            <span key={t} style={{
              padding: "2px 6px", borderRadius: 3, fontSize: 11,
              background: hasSignal && Math.abs(detected!.tone_hz - t) < 1.0 ? "#2a4" : "#1a1a2e",
              color: hasSignal && Math.abs(detected!.tone_hz - t) < 1.0 ? "#fff" : "#446",
              fontFamily: "monospace",
            }}>
              {t.toFixed(1)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
