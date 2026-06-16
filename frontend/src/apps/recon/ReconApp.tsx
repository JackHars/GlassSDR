import { useEffect, useState, useRef, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import { AppScreen } from "../../components/kit/AppScreen";
import { GlassPanel } from "../../components/kit/GlassPanel";
import { RecordBar } from "../../components/RecordBar";
import type { AppId } from "../../ipc/types/AppId";
import "./Recon.css";

const N_COLS = 60;
const N_ROWS = 20;
const NOISE = -110;
const STRONG = -50;
const TICK_MS = 1500;

function dbToCell(db: number): string {
  const t = Math.max(0, Math.min(1, (db - NOISE) / (STRONG - NOISE)));
  if (t < 0.08) return "rgba(14,18,32,0.90)";
  if (t < 0.30) return `rgba(${Math.round(40 + t * 140)},${Math.round(50 + t * 80)},${Math.round(90 + t * 40)},0.80)`;
  const u = Math.min(1, (t - 0.30) / 0.70);
  return `rgba(${Math.round(120 + u * 135)},${Math.round(100 + u * 90)},${Math.round(30 + u * 10)},0.90)`;
}

function emptyRow(): number[] {
  return Array(N_COLS).fill(NOISE);
}

function freqToCol(hz: number, startHz: number, stopHz: number): number {
  const t = (hz - startHz) / (stopHz - startHz);
  return Math.max(0, Math.min(N_COLS - 1, Math.floor(t * N_COLS)));
}

function Heatmap({
  rows,
  startHz,
  stopHz,
}: {
  rows: number[][];
  startHz: number;
  stopHz: number;
}) {
  const axisFreqs = [0, 0.25, 0.5, 0.75, 1].map(
    (t) => startHz + t * (stopHz - startHz)
  );

  return (
    <div className="recon__heatmap-wrap">
      {/* Cell grid */}
      <div className="recon__heatmap-grid">
        {rows.map((row, ri) => (
          <div key={ri} className="recon__heatmap-row">
            {row.map((db, ci) => (
              <div
                key={ci}
                className="recon__heatmap-cell"
                style={{ background: dbToCell(db) }}
                title={`${((startHz + (ci / N_COLS) * (stopHz - startHz)) / 1e6).toFixed(2)} MHz · ${db.toFixed(0)} dB`}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Frequency axis */}
      <div className="recon__heatmap-axis">
        {axisFreqs.map((hz, i) => (
          <span key={i} className="recon__axis-label">
            {(hz / 1e6).toFixed(0)} MHz
          </span>
        ))}
      </div>

      {/* Time label */}
      <div className="recon__time-label">
        <span>now ↑</span>
        <span>{(N_ROWS * TICK_MS / 1000).toFixed(0)} s ↓</span>
      </div>
    </div>
  );
}

interface Hit {
  freq_hz: number;
  power_db: number;
  count: number;
}

export function ReconApp() {
  const [startHz, setStartHz] = useState(88_000_000);
  const [stopHz, setStopHz] = useState(1_000_000_000);
  const [stepHz, setStepHz] = useState(100_000);
  const [running, setRunning] = useState(false);

  const [rows, setRows] = useState<number[][]>(() =>
    Array.from({ length: N_ROWS }, emptyRow)
  );
  const [topHits, setTopHits] = useState<Hit[]>([]);

  const currentRowRef = useRef<number[]>(emptyRow());
  const hitMapRef = useRef<Map<number, Hit>>(new Map());
  const startHzRef = useRef(startHz);
  const stopHzRef = useRef(stopHz);

  useEffect(() => { startHzRef.current = startHz; }, [startHz]);
  useEffect(() => { stopHzRef.current = stopHz; }, [stopHz]);

  // Listen for scan results
  useEffect(() => {
    const p = listen<{ freq_hz: number; power_db: number }>("scan_result", (e) => {
      const { freq_hz, power_db } = e.payload;
      const col = freqToCol(freq_hz, startHzRef.current, stopHzRef.current);
      currentRowRef.current[col] = Math.max(currentRowRef.current[col], power_db);

      // Update hit map
      const colKey = col;
      const existing = hitMapRef.current.get(colKey);
      if (!existing || power_db > existing.power_db) {
        hitMapRef.current.set(colKey, {
          freq_hz,
          power_db: existing ? Math.max(power_db, existing.power_db) : power_db,
          count: (existing?.count ?? 0) + 1,
        });
      }
    });
    return () => { p.then((fn) => fn()); };
  }, []);

  // Advance heatmap row on tick
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const snapped = [...currentRowRef.current];
      currentRowRef.current = emptyRow();
      setRows((prev) => [snapped, ...prev.slice(0, N_ROWS - 1)]);

      const sorted = [...hitMapRef.current.values()]
        .filter((h) => h.power_db > -80)
        .sort((a, b) => b.power_db - a.power_db)
        .slice(0, 50);
      setTopHits(sorted);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [running]);

  const handleStart = useCallback(async () => {
    setRows(Array.from({ length: N_ROWS }, emptyRow));
    setTopHits([]);
    hitMapRef.current.clear();
    currentRowRef.current = emptyRow();
    await startApp("recon" as AppId, {
      start_hz: startHz, stop_hz: stopHz, step_hz: stepHz,
      lna_gain_db: 32, vga_gain_db: 20, amp_enabled: false,
    });
    setRunning(true);
  }, [startHz, stopHz, stepHz]);

  const handleStop = useCallback(async () => {
    await stopApp();
    setRunning(false);
  }, []);

  const totalHits = topHits.length;

  return (
    <AppScreen
      appId="recon"
      title="Recon Scanner"
      subtitle={`${(startHz / 1e6).toFixed(0)}–${(stopHz / 1e6).toFixed(0)} MHz`}
      status={running ? "live" : totalHits > 0 ? "empty" : "idle"}
      statusText={running ? `Scanning · ${totalHits} signals` : totalHits > 0 ? `${totalHits} signals logged` : "Idle"}
    >
      {/* Controls */}
      <div className="recon__controls">
        <div className="recon__param-row">
          <div className="recon__field">
            <label className="recon__field-label">Start MHz</label>
            <input className="recon__input" type="number" value={startHz / 1e6} step={1}
              onChange={(e) => setStartHz(Math.round((parseFloat(e.target.value) || 0) * 1e6))} />
          </div>
          <div className="recon__field">
            <label className="recon__field-label">Stop MHz</label>
            <input className="recon__input" type="number" value={stopHz / 1e6} step={1}
              onChange={(e) => setStopHz(Math.round((parseFloat(e.target.value) || 0) * 1e6))} />
          </div>
          <div className="recon__field">
            <label className="recon__field-label">Step kHz</label>
            <input className="recon__input recon__input--sm" type="number"
              value={stepHz / 1e3} step={1}
              onChange={(e) => setStepHz(Math.round((parseFloat(e.target.value) || 0) * 1e3))} />
          </div>
          <div className="recon__actions">
            <button className={`recon__btn recon__btn--start${running ? " recon__btn--off" : ""}`}
              onClick={handleStart} disabled={running}>▶ Scan</button>
            <button className={`recon__btn recon__btn--stop${!running ? " recon__btn--off" : ""}`}
              onClick={handleStop} disabled={!running}>■ Stop</button>
            <button className="recon__btn recon__btn--clear"
              onClick={() => {
                setRows(Array.from({ length: N_ROWS }, emptyRow));
                setTopHits([]);
                hitMapRef.current.clear();
              }}>Clear</button>
          </div>
        </div>
      </div>

      {/* Heatmap hero */}
      <GlassPanel title="Frequency × Time Activity Map" size="fill" pad="sm" className="recon__heatmap-panel">
        <Heatmap rows={rows} startHz={startHz} stopHz={stopHz} />
        <div className="recon__legend">
          <span className="recon__legend-item">
            <span className="recon__legend-swatch recon__legend-swatch--noise" />
            Noise floor
          </span>
          <span className="recon__legend-item">
            <span className="recon__legend-swatch recon__legend-swatch--weak" />
            Weak
          </span>
          <span className="recon__legend-item">
            <span className="recon__legend-swatch recon__legend-swatch--strong" />
            Strong
          </span>
          <span className="recon__legend-sep">·</span>
          <span className="recon__legend-item recon__legend-item--info">
            Each row = {(TICK_MS / 1000).toFixed(1)} s · {N_COLS} bins
          </span>
        </div>
      </GlassPanel>

      {/* Top signals */}
      <GlassPanel
        title={`Top Signals · ${totalHits}`}
        size="fill"
        pad="none"
        className="recon__hits-panel"
      >
        {topHits.length === 0 ? (
          <div className="recon__empty">
            {running ? "Logging…" : "No signals above −80 dB — press ▶ Scan"}
          </div>
        ) : (
          <div className="recon__hits-list">
            <div className="recon__hits-hdr">
              <span>Frequency</span>
              <span>Peak dB</span>
              <span>Hits</span>
              <span className="recon__hdr-bar">Level</span>
            </div>
            {topHits.map((h, i) => {
              const pct = Math.max(0, Math.min(100, ((h.power_db + 100) / 60) * 100));
              return (
                <div key={i} className="recon__hit-row">
                  <span className="recon__hit-freq">{(h.freq_hz / 1e6).toFixed(3)} MHz</span>
                  <span className={`recon__hit-pwr${h.power_db > -60 ? " recon__hit-pwr--strong" : ""}`}>
                    {h.power_db.toFixed(1)}
                  </span>
                  <span className="recon__hit-count">{h.count}</span>
                  <div className="recon__hit-bar-wrap">
                    <div className="recon__hit-bar" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassPanel>

      <RecordBar
        appId={"recon" as Parameters<typeof RecordBar>[0]["appId"]}
        format="jsonl"
      />
    </AppScreen>
  );
}
