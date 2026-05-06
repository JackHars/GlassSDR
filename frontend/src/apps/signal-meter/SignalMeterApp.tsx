import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";

interface SpectrumFrame { seq: number; bins: number[]; center_hz: number; span_hz: number; }

const BAR_W = 300, BAR_H = 24;
const DB_MIN = -120, DB_MAX = -20;

function peakDbm(bins: number[]): number {
  const peak = Math.max(...bins);
  return DB_MIN + (peak / 255) * (DB_MAX - DB_MIN);
}

export function SignalMeterApp() {
  const [freqMhz, setFreqMhz] = useState("433.92");
  const [running, setRunning] = useState(false);
  const [dbm, setDbm] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const unlisten = listen<SpectrumFrame>("spectrum", (e) => {
      const db = peakDbm(e.payload.bins);
      setDbm(db);
      const cv = canvasRef.current; if (!cv) return;
      const ctx = cv.getContext("2d")!;
      ctx.fillStyle = "#111"; ctx.fillRect(0,0,BAR_W,BAR_H);
      const frac = Math.max(0, Math.min(1, (db - DB_MIN) / (DB_MAX - DB_MIN)));
      const r = Math.floor(frac * 255), g = Math.floor((1-frac)*200);
      ctx.fillStyle = `rgb(${r},${g},40)`;
      ctx.fillRect(0, 0, Math.floor(frac * BAR_W), BAR_H);
    });
    return () => { unlisten.then(f => f()); };
  }, []);

  const start = () => {
    const hz = parseFloat(freqMhz) * 1e6;
    if (!isFinite(hz)) return;
    startApp("signal_meter" as AppId, { center_hz: hz, lna_gain_db: 32, vga_gain_db: 20, amp_enabled: false });
    setRunning(true);
  };
  const stop = () => { stopApp(); setRunning(false); };

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>Signal Meter</h2>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <label style={{ color: "#aaa", fontSize: 13 }}>Frequency (MHz)</label>
        <input value={freqMhz} onChange={e => setFreqMhz(e.target.value)} style={{ width: 100, background: "#222", color: "#eee", border: "1px solid #444", borderRadius: 3, padding: "4px 8px" }} />
        <button onClick={start} disabled={running} style={{ padding: "6px 14px", background: "#262", color: "#eee", border: "none", borderRadius: 3, cursor: "pointer" }}>Start</button>
        <button onClick={stop} disabled={!running} style={{ padding: "6px 14px", background: "#622", color: "#eee", border: "none", borderRadius: 3, cursor: "pointer" }}>Stop</button>
      </div>
      <div style={{ fontSize: 48, fontFamily: "monospace", color: dbm !== null ? "#8cf" : "#444", marginBottom: 12 }}>
        {dbm !== null ? `${dbm.toFixed(1)} dBm` : "—"}
      </div>
      <canvas ref={canvasRef} width={BAR_W} height={BAR_H} style={{ border: "1px solid #333", display: "block", borderRadius: 3 }} />
      <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", width: BAR_W, fontSize: 11, color: "#555" }}>
        <span>{DB_MIN} dBm</span><span>{DB_MAX} dBm</span>
      </div>
    </div>
  );
}
