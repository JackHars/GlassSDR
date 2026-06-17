import { useEffect, useState, useCallback, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import { AppScreen } from "../../components/kit/AppScreen";
import { GlassPanel } from "../../components/kit/GlassPanel";
import { Gauge, StatReadout } from "../../components/kit/StatReadout";
import { RecordBar } from "../../components/RecordBar";
import type { AppId } from "../../ipc/types/AppId";
import "./SignalMeter.css";

interface SpectrumFrame {
  seq: number;
  bins: number[];
  center_hz: number;
  span_hz: number;
}

const DB_MIN = -121;
const DB_MAX = -20;
const HIST_LEN = 80;

function binsToDbm(bins: number[]): number {
  if (!bins.length) return DB_MIN;
  const peak = Math.max(...bins);
  return DB_MIN + (peak / 255) * (DB_MAX - DB_MIN);
}

/** Convert dBm to S-unit string */
function dbmToSUnit(db: number): string {
  if (db <= -121) return "S1";
  if (db <= -115) return "S2";
  if (db <= -109) return "S3";
  if (db <= -103) return "S4";
  if (db <=  -97) return "S5";
  if (db <=  -91) return "S6";
  if (db <=  -85) return "S7";
  if (db <=  -79) return "S8";
  if (db <=  -73) return "S9";
  const over = Math.round((db + 73) / 10) * 10;
  return `S9+${over}`;
}

/** Mini bar chart of recent dBm history */
function DbmHistory({ history }: { history: number[] }) {
  const W = 560;
  const H = 48;
  const barW = W / HIST_LEN;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="smeter__hist-svg" preserveAspectRatio="none"
      aria-label="Signal strength history">
      <rect width={W} height={H} fill="rgba(6,12,10,0.55)" />
      {history.map((db, i) => {
        const t = Math.max(0, Math.min(1, (db - DB_MIN) / (DB_MAX - DB_MIN)));
        const barH = Math.max(2, t * (H - 4));
        const green = Math.round(t * 200);
        const red = Math.round(t * 80);
        return (
          <rect
            key={i}
            x={i * barW + 0.5} y={H - barH - 2}
            width={Math.max(1, barW - 1)} height={barH}
            fill={`rgba(${red},${green + 56},40,0.80)`}
            rx={0.5}
          />
        );
      })}
      {/* Current level marker */}
      {history.length > 0 && (
        <line
          x1={history.length * barW - barW / 2} y1={0}
          x2={history.length * barW - barW / 2} y2={H}
          stroke="rgba(40,184,96,0.60)" strokeWidth={1.5}
        />
      )}
    </svg>
  );
}

export function SignalMeterApp() {
  const [freqMhz, setFreqMhz] = useState("433.920");
  const [lnaGain, setLnaGain] = useState(32);
  const [running, setRunning] = useState(false);
  const [dbm, setDbm] = useState<number | null>(null);
  const [peakDbm, setPeakDbm] = useState<number | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const peakRef = useRef<number>(DB_MIN);

  useEffect(() => {
    const p = listen<SpectrumFrame>("spectrum", (e) => {
      const db = binsToDbm(e.payload.bins);
      setDbm(db);
      if (db > peakRef.current) {
        peakRef.current = db;
        setPeakDbm(db);
      }
      setHistory((prev) => [...prev, db].slice(-HIST_LEN));
    });
    return () => { p.then((fn) => fn()); };
  }, []);

  const handleStart = useCallback(async () => {
    const hz = parseFloat(freqMhz) * 1e6;
    if (!isFinite(hz)) return;
    peakRef.current = DB_MIN;
    setPeakDbm(null);
    setDbm(null);
    setHistory([]);
    await startApp("signal_meter" as AppId, {
      center_hz: hz, lna_gain_db: lnaGain, vga_gain_db: 20, amp_enabled: false,
    });
    setRunning(true);
  }, [freqMhz, lnaGain]);

  const handleStop = useCallback(async () => {
    await stopApp();
    setRunning(false);
  }, []);

  const sUnit = dbm !== null ? dbmToSUnit(dbm) : "—";
  const freqHz = parseFloat(freqMhz) * 1e6 || undefined;

  return (
    <AppScreen
      appId="signal_meter"
      title="Signal Meter"
      subtitle={`${freqMhz} MHz · S-meter`}
      status={running ? "live" : "idle"}
      statusText={running ? `${sUnit} · ${dbm !== null ? dbm.toFixed(1) : "—"} dBm` : "Idle"}
    >
      {/* Controls */}
      <div className="smeter__controls">
        <div className="smeter__field">
          <label className="smeter__field-label">Frequency (MHz)</label>
          <input className="smeter__input" type="number" value={freqMhz} step={0.001}
            onChange={(e) => setFreqMhz(e.target.value)} />
        </div>
        <div className="smeter__field smeter__field--gain">
          <label className="smeter__field-label">LNA {lnaGain} dB</label>
          <input type="range" min={0} max={40} value={lnaGain}
            className="smeter__slider" onChange={(e) => setLnaGain(+e.target.value)} />
        </div>
        <div className="smeter__actions">
          <button className={`smeter__btn smeter__btn--start${running ? " smeter__btn--off" : ""}`}
            onClick={handleStart} disabled={running}>▶ Start</button>
          <button className={`smeter__btn smeter__btn--stop${!running ? " smeter__btn--off" : ""}`}
            onClick={handleStop} disabled={!running}>■ Stop</button>
          <button className="smeter__btn smeter__btn--clear" onClick={() => {
            peakRef.current = DB_MIN;
            setPeakDbm(null);
            setHistory([]);
          }}>Reset pk</button>
        </div>
      </div>

      {/* S-meter hero */}
      <GlassPanel title="S-Meter" pad="md" className="smeter__gauge-panel">
        <div className="smeter__gauge-layout">
          {/* The Gauge */}
          <div className="smeter__gauge-wrap">
            <Gauge
              value={dbm ?? DB_MIN}
              min={DB_MIN}
              max={DB_MAX}
              peak={peakDbm ?? undefined}
              unit="dBm"
              size={200}
              showValue={false}
            />
            {/* S-unit scale labels around the arc */}
            <div className="smeter__s-scale">
              {["S1","S3","S5","S7","S9","S9+20","S9+40"].map((s) => (
                <span key={s} className="smeter__s-tick">{s}</span>
              ))}
            </div>
          </div>

          {/* Readouts beside the gauge */}
          <div className="smeter__readouts">
            <StatReadout
              label="Signal"
              value={dbm}
              unit="dBm"
              size="lg"
              digits={1}
              peak={peakDbm}
            />
            <div className="smeter__s-unit-display">
              <span className="smeter__s-unit-label">S-Unit</span>
              <span className="smeter__s-unit-value">{sUnit}</span>
            </div>
            {peakDbm !== null && (
              <div className="smeter__peak-row">
                <span className="smeter__peak-label">Peak hold</span>
                <span className="smeter__peak-val">{peakDbm.toFixed(1)} dBm</span>
                <span className="smeter__peak-s">{dbmToSUnit(peakDbm)}</span>
              </div>
            )}
          </div>
        </div>
      </GlassPanel>

      {/* dBm history strip-chart */}
      <GlassPanel title={`Signal History · ${history.length} samples`} pad="sm"
        className="smeter__hist-panel">
        {history.length === 0 ? (
          <div className="smeter__hist-empty">No samples yet — press ▶ Start</div>
        ) : (
          <DbmHistory history={history} />
        )}
        <div className="smeter__hist-axis">
          <span>{DB_MIN} dBm</span>
          <span>Signal Strength</span>
          <span>{DB_MAX} dBm</span>
        </div>
      </GlassPanel>

      <RecordBar
        appId={"signal_meter" as Parameters<typeof RecordBar>[0]["appId"]}
        format="jsonl"
        centerHz={freqHz}
      />
    </AppScreen>
  );
}
