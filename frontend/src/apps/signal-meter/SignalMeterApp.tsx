import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";
import { RecordBar } from "../../components/RecordBar";
import { AppShell, ControlField, ControlRow } from "../../components/AppShell";

interface SpectrumFrame { seq: number; bins: number[]; center_hz: number; span_hz: number; }

const BAR_W = 480, BAR_H = 28;
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
      const cv = canvasRef.current;
      if (!cv) return;
      const ctx = cv.getContext("2d")!;
      ctx.fillStyle = "rgba(0,0,0,0.06)";
      ctx.fillRect(0, 0, BAR_W, BAR_H);
      const frac = Math.max(0, Math.min(1, (db - DB_MIN) / (DB_MAX - DB_MIN)));
      const r = Math.floor(frac * 255), g = Math.floor((1 - frac) * 200);
      ctx.fillStyle = `rgb(${r},${g},40)`;
      ctx.fillRect(0, 0, Math.floor(frac * BAR_W), BAR_H);
    });
    return () => { unlisten.then((f) => f()); };
  }, []);

  const start = async () => {
    const hz = parseFloat(freqMhz) * 1e6;
    if (!isFinite(hz)) return;
    await startApp("signal_meter" as AppId, { center_hz: hz, lna_gain_db: 32, vga_gain_db: 20, amp_enabled: false });
    setRunning(true);
  };
  const stop = async () => { await stopApp(); setRunning(false); };

  return (
    <AppShell
      title="Signal Meter"
      status={running ? <><span style={{color: "#34C759"}}>●</span> Measuring</> : <><span style={{color: "#999"}}>○</span> Idle</>}
      controls={
        <ControlRow
          actions={
            <>
              <button className="glass-btn primary" onClick={start} disabled={running}>Start</button>
              <button className="glass-btn" onClick={stop} disabled={!running}>Stop</button>
            </>
          }
        >
          <ControlField label="Frequency (MHz)" size="md">
            <input type="text" value={freqMhz} onChange={(e) => setFreqMhz(e.target.value)} />
          </ControlField>
        </ControlRow>
      }
      footer={<RecordBar appId={"signal_meter" as any} format="jsonl" centerHz={parseFloat(freqMhz) * 1e6} />}
    >
      <div className="app-shell__grow" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 650, textTransform: "uppercase", letterSpacing: 0.6, color: "var(--text-secondary)" }}>
          Peak Power
        </div>
        <div style={{ fontSize: 64, fontFamily: "var(--font-mono)", color: dbm !== null ? "var(--accent)" : "var(--text-tertiary)" }}>
          {dbm !== null ? `${dbm.toFixed(1)} dBm` : "—"}
        </div>
        <canvas ref={canvasRef} width={BAR_W} height={BAR_H} style={{ borderRadius: 6, background: "rgba(0,0,0,0.04)", display: "block" }} />
        <div style={{ display: "flex", justifyContent: "space-between", width: BAR_W, fontSize: 11, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
          <span>{DB_MIN} dBm</span><span>{DB_MAX} dBm</span>
        </div>
      </div>
    </AppShell>
  );
}
