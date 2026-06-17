import { useEffect, useState, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import { AppScreen } from "../../components/kit/AppScreen";
import { GlassPanel } from "../../components/kit/GlassPanel";
import { RecordBar } from "../../components/RecordBar";
import type { AppId } from "../../ipc/types/AppId";
import "./Scanner.css";

interface ScanHit {
  freq_hz: number;
  power_db: number;
  ts: number;
}

const SIGNAL_THRESHOLD = -80;

const BAND_PRESETS = [
  { label: "VHF Air",  start: 108_000_000, stop: 137_000_000, step: 25_000 },
  { label: "Marine",   start: 156_000_000, stop: 174_000_000, step: 25_000 },
  { label: "PMR 446",  start: 446_000_000, stop: 446_200_000, step: 12_500 },
  { label: "ISM 433",  start: 433_050_000, stop: 434_790_000, step: 25_000 },
  { label: "UHF 400",  start: 400_000_000, stop: 500_000_000, step: 25_000 },
  { label: "900 ISM",  start: 902_000_000, stop: 928_000_000, step: 25_000 },
];

function fmtMhz(hz: number) {
  return `${(hz / 1e6).toFixed(3)}`;
}

function powerToHeight(db: number): number {
  return Math.max(0.04, Math.min(1.0, (db + 120) / 90));
}

function powerColor(db: number): string {
  if (db > -60) return "rgba(50,200,100,0.85)";
  if (db > -75) return "rgba(50,200,100,0.50)";
  return "rgba(96,128,168,0.35)";
}

function BandSweep({
  hits,
  startHz,
  stopHz,
  running,
}: {
  hits: ScanHit[];
  startHz: number;
  stopHz: number;
  running: boolean;
}) {
  const W = 600;
  const H = 80;
  const PAD_X = 8;
  const AXIS_Y = H - 14;
  const rangeHz = stopHz - startHz || 1;
  const toX = (hz: number) =>
    PAD_X + ((hz - startHz) / rangeHz) * (W - 2 * PAD_X);

  return (
    <div className="scanner__sweep-wrap">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="scanner__sweep-svg"
        aria-label="Frequency sweep band"
        preserveAspectRatio="none"
      >
        <rect x={PAD_X} y={0} width={W - 2 * PAD_X} height={AXIS_Y}
          fill="rgba(6,10,20,0.50)" rx={2} />

        <line x1={PAD_X} y1={AXIS_Y} x2={W - PAD_X} y2={AXIS_Y}
          stroke="rgba(96,128,168,0.30)" strokeWidth={0.8} />

        {/* Threshold dashed line */}
        <line
          x1={PAD_X} y1={AXIS_Y * (1 - powerToHeight(SIGNAL_THRESHOLD))}
          x2={W - PAD_X} y2={AXIS_Y * (1 - powerToHeight(SIGNAL_THRESHOLD))}
          stroke="rgba(96,128,168,0.22)" strokeWidth={0.6} strokeDasharray="4 4"
        />

        {/* Axis labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const hz = startHz + t * rangeHz;
          return (
            <text key={t} x={PAD_X + t * (W - 2 * PAD_X)} y={H - 2}
              className="scanner__axis-label" textAnchor="middle">
              {fmtMhz(hz)}
            </text>
          );
        })}

        {/* Hit bars */}
        {hits.map((h, i) => {
          const x = toX(h.freq_hz);
          if (x < PAD_X || x > W - PAD_X) return null;
          const barH = powerToHeight(h.power_db) * (AXIS_Y - 2);
          return (
            <rect key={i} x={x - 1} y={AXIS_Y - barH}
              width={2} height={barH}
              fill={powerColor(h.power_db)} rx={0.5}
            />
          );
        })}

        {/* Animated playhead */}
        {running && (
          <line x1={0} y1={0} x2={0} y2={AXIS_Y}
            stroke="rgba(96,200,168,0.90)" strokeWidth={1.5}
            className="scanner__playhead"
          />
        )}

        {/* Watermark */}
        <text x={W / 2} y={AXIS_Y / 2 + 8}
          className="scanner__sweep-mark" textAnchor="middle">
          SWEEP
        </text>
      </svg>
    </div>
  );
}

export function ScannerApp() {
  const [hits, setHits] = useState<ScanHit[]>([]);
  const [running, setRunning] = useState(false);
  const [startHz, setStartHz] = useState(400_000_000);
  const [stopHz, setStopHz] = useState(500_000_000);
  const [stepHz, setStepHz] = useState(25_000);
  const [lnaGain, setLnaGain] = useState(32);
  const [vgaGain] = useState(20);

  useEffect(() => {
    const p = listen<{ freq_hz: number; power_db: number }>("scan_result", (e) => {
      setHits((prev) =>
        [{ ...e.payload, ts: Date.now() }, ...prev].slice(0, 2000)
      );
    });
    return () => { p.then((fn) => fn()); };
  }, []);

  const handleStart = useCallback(async () => {
    setHits([]);
    await startApp("scanner" as AppId, {
      start_hz: startHz, stop_hz: stopHz, step_hz: stepHz,
      lna_gain_db: lnaGain, vga_gain_db: vgaGain, amp_enabled: false,
    });
    setRunning(true);
  }, [startHz, stopHz, stepHz, lnaGain, vgaGain]);

  const handleStop = useCallback(async () => {
    await stopApp();
    setRunning(false);
  }, []);

  const aboveThreshold = hits.filter((h) => h.power_db > SIGNAL_THRESHOLD);
  const topHits = [...aboveThreshold]
    .sort((a, b) => b.power_db - a.power_db)
    .slice(0, 100);

  return (
    <AppScreen
      appId="scanner"
      title="Frequency Scanner"
      subtitle={`${fmtMhz(startHz)}–${fmtMhz(stopHz)} MHz`}
      status={running ? "live" : hits.length > 0 ? "empty" : "idle"}
      statusText={
        running
          ? `Sweeping · ${hits.length} samples`
          : aboveThreshold.length > 0
          ? `${aboveThreshold.length} hits above ${SIGNAL_THRESHOLD} dB`
          : "Idle"
      }
    >
      {/* Controls */}
      <div className="scanner__controls">
        <div className="scanner__presets">
          {BAND_PRESETS.map((p) => (
            <button key={p.label} className="scanner__preset-btn"
              onClick={() => { setStartHz(p.start); setStopHz(p.stop); setStepHz(p.step); }}>
              {p.label}
            </button>
          ))}
        </div>

        <div className="scanner__param-row">
          <div className="scanner__field">
            <label className="scanner__field-label">Start MHz</label>
            <input className="scanner__input" type="number" value={startHz / 1e6} step={0.1}
              onChange={(e) => setStartHz(Math.round((parseFloat(e.target.value) || 0) * 1e6))} />
          </div>
          <div className="scanner__field">
            <label className="scanner__field-label">Stop MHz</label>
            <input className="scanner__input" type="number" value={stopHz / 1e6} step={0.1}
              onChange={(e) => setStopHz(Math.round((parseFloat(e.target.value) || 0) * 1e6))} />
          </div>
          <div className="scanner__field">
            <label className="scanner__field-label">Step kHz</label>
            <input className="scanner__input scanner__input--sm" type="number"
              value={stepHz / 1e3} step={1}
              onChange={(e) => setStepHz(Math.round((parseFloat(e.target.value) || 0) * 1e3))} />
          </div>
          <div className="scanner__field scanner__field--gain">
            <label className="scanner__field-label">LNA {lnaGain} dB</label>
            <input type="range" min={0} max={40} value={lnaGain}
              className="scanner__slider"
              onChange={(e) => setLnaGain(+e.target.value)} />
          </div>
          <div className="scanner__actions">
            <button className={`scanner__btn scanner__btn--start${running ? " scanner__btn--off" : ""}`}
              onClick={handleStart} disabled={running}>▶ Scan</button>
            <button className={`scanner__btn scanner__btn--stop${!running ? " scanner__btn--off" : ""}`}
              onClick={handleStop} disabled={!running}>■ Stop</button>
            <button className="scanner__btn scanner__btn--clear"
              onClick={() => setHits([])}>Clear</button>
          </div>
        </div>
      </div>

      {/* Band sweep hero */}
      <GlassPanel title="Band Sweep" size="fill" pad="sm" className="scanner__sweep-panel">
        <BandSweep hits={hits} startHz={startHz} stopHz={stopHz} running={running} />
      </GlassPanel>

      {/* Hit list */}
      <GlassPanel
        title={`Signals above ${SIGNAL_THRESHOLD} dB · ${aboveThreshold.length}`}
        size="fill"
        pad="none"
        className="scanner__hits-panel"
      >
        {topHits.length === 0 ? (
          <div className="scanner__empty">
            {running ? "Scanning — no signals above threshold yet…" : "No hits — set a range and press ▶ Scan"}
          </div>
        ) : (
          <div className="scanner__hits-list">
            <div className="scanner__hits-hdr">
              <span>Frequency</span>
              <span>Power</span>
              <span className="scanner__hdr-level">Level</span>
            </div>
            {topHits.map((h, i) => {
              const pct = Math.max(0, Math.min(100, ((h.power_db + 100) / 60) * 100));
              return (
                <div key={i} className="scanner__hit-row">
                  <span className="scanner__hit-freq">{fmtMhz(h.freq_hz)} MHz</span>
                  <span className={`scanner__hit-pwr${h.power_db > -60 ? " scanner__hit-pwr--strong" : ""}`}>
                    {h.power_db.toFixed(1)} dB
                  </span>
                  <div className="scanner__hit-bar-wrap">
                    <div className="scanner__hit-bar" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassPanel>

      <RecordBar
        appId={"scanner" as Parameters<typeof RecordBar>[0]["appId"]}
        format="jsonl"
      />
    </AppScreen>
  );
}
