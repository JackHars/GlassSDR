import { useEffect, useState, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import { AppScreen } from "../../components/kit/AppScreen";
import { GlassPanel } from "../../components/kit/GlassPanel";
import { RecordBar } from "../../components/RecordBar";
import type { AppId } from "../../ipc/types/AppId";
import "./FreqCounter.css";

interface FreqMeasureEvent {
  frequency_hz: number;
  precision_hz: number;
}

interface Reading {
  hz: number;
  precision: number;
  ts: Date;
}

type GateMs = 100 | 1000 | 10000;
const GATE_OPTIONS: { label: string; value: GateMs }[] = [
  { label: "100 ms", value: 100  },
  { label: "1 s",    value: 1000  },
  { label: "10 s",   value: 10000 },
];

/** Format Hz to a human-readable string with appropriate precision */
function formatHz(hz: number, precision: number): string {
  if (hz >= 1e9) {
    const digits = Math.max(0, -Math.floor(Math.log10(precision / 1e9)));
    return `${(hz / 1e9).toFixed(Math.min(digits + 6, 9))} GHz`;
  }
  if (hz >= 1e6) {
    const digits = Math.max(0, -Math.floor(Math.log10(precision / 1e6)));
    return `${(hz / 1e6).toFixed(Math.min(digits + 3, 9))} MHz`;
  }
  if (hz >= 1e3) {
    return `${(hz / 1e3).toFixed(3)} kHz`;
  }
  return `${hz.toFixed(1)} Hz`;
}

/** Split display into integer and fractional parts with groups */
function displayParts(hz: number): { int: string; frac: string; unit: string } {
  if (hz >= 1e9) {
    const s = (hz / 1e9).toFixed(9);
    const [i, f] = s.split(".");
    return { int: i, frac: f ?? "000000000", unit: "GHz" };
  }
  if (hz >= 1e6) {
    const s = (hz / 1e6).toFixed(9);
    const [i, f] = s.split(".");
    return { int: i, frac: f ?? "000000000", unit: "MHz" };
  }
  const s = hz.toFixed(3);
  const [i, f] = s.split(".");
  return { int: i, frac: f ?? "000", unit: "Hz" };
}

function stabilityLabel(readings: Reading[]): { label: string; cls: string } {
  if (readings.length < 2) return { label: "MEASURING", cls: "measuring" };
  const hzs = readings.map((r) => r.hz);
  const spread = Math.max(...hzs) - Math.min(...hzs);
  if (spread < 5)   return { label: "LOCKED",   cls: "locked"   };
  if (spread < 50)  return { label: "STABLE",   cls: "stable"   };
  if (spread < 500) return { label: "SETTLING", cls: "settling" };
  return { label: "DRIFTING", cls: "drifting" };
}

export function FreqCounterApp() {
  const [centerHz, setCenterHz] = useState(100_000_000);
  const [gateMs, setGateMs] = useState<GateMs>(1000);
  const [running, setRunning] = useState(false);
  const [latest, setLatest] = useState<Reading | null>(null);
  const [history, setHistory] = useState<Reading[]>([]);

  useEffect(() => {
    const p = listen<FreqMeasureEvent>("freq_measure", (e) => {
      const reading: Reading = {
        hz: e.payload.frequency_hz,
        precision: e.payload.precision_hz,
        ts: new Date(),
      };
      setLatest(reading);
      setHistory((prev) => [reading, ...prev].slice(0, 20));
    });
    return () => { p.then((fn) => fn()); };
  }, []);

  const handleStart = useCallback(async () => {
    setLatest(null);
    setHistory([]);
    await startApp("freq_counter" as AppId, { center_hz: centerHz, gate_ms: gateMs });
    setRunning(true);
  }, [centerHz, gateMs]);

  const handleStop = useCallback(async () => {
    await stopApp();
    setRunning(false);
  }, []);

  const stability = stabilityLabel(history);
  const parts = latest ? displayParts(latest.hz) : null;

  return (
    <AppScreen
      appId="freq_counter"
      title="Frequency Counter"
      subtitle={`Gate: ${gateMs >= 1000 ? `${gateMs / 1000} s` : `${gateMs} ms`}`}
      status={running ? "live" : latest ? "empty" : "idle"}
      statusText={running ? `Measuring · ${stability.label}` : latest ? stability.label : "Idle"}
    >
      {/* Controls */}
      <div className="fcount__controls">
        <div className="fcount__field">
          <label className="fcount__field-label">Center (MHz)</label>
          <input className="fcount__input" type="number" value={centerHz / 1e6}
            step={0.001}
            onChange={(e) => setCenterHz(Math.round((parseFloat(e.target.value) || 0) * 1e6))} />
        </div>
        <div className="fcount__field">
          <label className="fcount__field-label">Gate time</label>
          <div className="fcount__gate-btns">
            {GATE_OPTIONS.map((g) => (
              <button key={g.value}
                className={`fcount__gate-btn${gateMs === g.value ? " fcount__gate-btn--sel" : ""}`}
                onClick={() => setGateMs(g.value)}>
                {g.label}
              </button>
            ))}
          </div>
        </div>
        <div className="fcount__actions">
          <button className={`fcount__btn fcount__btn--start${running ? " fcount__btn--off" : ""}`}
            onClick={handleStart} disabled={running}>▶ Start</button>
          <button className={`fcount__btn fcount__btn--stop${!running ? " fcount__btn--off" : ""}`}
            onClick={handleStop} disabled={!running}>■ Stop</button>
        </div>
      </div>

      {/* Nixie/7-seg display hero */}
      <GlassPanel title="Measured Frequency" pad="lg" className="fcount__display-panel">
        <div className="fcount__nixie-wrap">
          {parts ? (
            <>
              <div className="fcount__nixie-display">
                <span className="fcount__nixie-int">{parts.int}</span>
                <span className="fcount__nixie-dot">.</span>
                {/* Fractional digits grouped as 3 */}
                <span className="fcount__nixie-frac">
                  {parts.frac.match(/.{1,3}/g)?.join(" ") ?? parts.frac}
                </span>
                <span className="fcount__nixie-unit">{parts.unit}</span>
              </div>
              <div className="fcount__meta-row">
                <span className="fcount__precision">±{latest!.precision.toFixed(1)} Hz</span>
                <span className={`fcount__stability fcount__stability--${stability.cls}`}>
                  <span className="fcount__stability-dot" />
                  {stability.label}
                </span>
              </div>
            </>
          ) : (
            <div className="fcount__nixie-idle">
              <span className="fcount__nixie-dash">_ _ _ . _ _ _ _ _ _</span>
              <span className="fcount__nixie-unit-idle">MHz</span>
            </div>
          )}
        </div>
      </GlassPanel>

      {/* Recent readings log */}
      <GlassPanel title={`Recent Readings · ${history.length}`} pad="none"
        className="fcount__history-panel">
        {history.length === 0 ? (
          <div className="fcount__hist-empty">
            {running ? "Waiting for measurement…" : "Press ▶ Start to begin counting"}
          </div>
        ) : (
          <div className="fcount__hist-list">
            <div className="fcount__hist-hdr">
              <span>Frequency</span>
              <span>Precision</span>
              <span>Time</span>
            </div>
            {history.map((r, i) => (
              <div key={i} className={`fcount__hist-row${i === 0 ? " fcount__hist-row--latest" : ""}`}>
                <span className="fcount__hist-hz">{formatHz(r.hz, r.precision)}</span>
                <span className="fcount__hist-prec">±{r.precision.toFixed(1)} Hz</span>
                <span className="fcount__hist-time">
                  {r.ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </GlassPanel>

      <RecordBar
        appId={"freq_counter" as Parameters<typeof RecordBar>[0]["appId"]}
        format="jsonl"
        centerHz={centerHz}
      />
    </AppScreen>
  );
}
