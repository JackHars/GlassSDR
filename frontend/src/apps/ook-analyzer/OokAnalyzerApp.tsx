import { useEffect, useState, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import { AppScreen } from "../../components/kit/AppScreen";
import { GlassPanel } from "../../components/kit/GlassPanel";
import { RecordBar } from "../../components/RecordBar";
import type { AppId } from "../../ipc/types/AppId";
import "./OokAnalyzer.css";

interface PulseEvent {
  is_high: boolean;
  duration_us: number;
}

const N_DISPLAY = 32; // pulses shown in the trace
const MAX_STORED = 500;

/** Infer bit from HIGH pulse duration relative to median HIGH. */
function inferBit(dur: number, medianHigh: number): string {
  if (medianHigh <= 0) return "?";
  return dur < medianHigh * 1.5 ? "0" : "1";
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}

function PulseTrace({ pulses }: { pulses: PulseEvent[] }) {
  if (pulses.length === 0) return null;

  const display = pulses.slice(0, N_DISPLAY);
  const totalUs = display.reduce((s, p) => s + p.duration_us, 0) || 1;

  // Metrics for bit inference
  const highDurs = display.filter((p) => p.is_high).map((p) => p.duration_us);
  const medHigh = median(highDurs);

  const W = 640;
  const H = 80;
  const HIGH_Y = 10;
  const LOW_Y = 50;
  const WIRE_H = 20; // height of the wave segment

  let curX = 0;
  type Seg = { x: number; w: number; isHigh: boolean; dur: number; bit?: string };
  const segs: Seg[] = display.map((p) => {
    const w = (p.duration_us / totalUs) * W;
    const seg: Seg = {
      x: curX,
      w,
      isHigh: p.is_high,
      dur: p.duration_us,
      bit: p.is_high ? inferBit(p.duration_us, medHigh) : undefined,
    };
    curX += w;
    return seg;
  });

  // Build the square-wave polyline
  const pts: [number, number][] = [];
  segs.forEach((seg, i) => {
    const y = seg.isHigh ? HIGH_Y : LOW_Y;
    if (i === 0) pts.push([seg.x, y]);
    else {
      const prevY = segs[i - 1].isHigh ? HIGH_Y : LOW_Y;
      if (prevY !== y) pts.push([seg.x, prevY], [seg.x, y]);
    }
    pts.push([seg.x + seg.w, y]);
  });

  const polyStr = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="ook-az__trace-svg"
      aria-label="OOK pulse timing diagram"
      preserveAspectRatio="none"
    >
      {/* Background */}
      <rect width={W} height={H} fill="rgba(6,6,14,0.60)" />

      {/* Grid lines */}
      {[HIGH_Y + WIRE_H / 2, LOW_Y + WIRE_H / 2].map((y, i) => (
        <line key={i} x1={0} y1={y} x2={W} y2={y}
          stroke="rgba(112,104,176,0.10)" strokeWidth={0.5} />
      ))}

      {/* Segment shading */}
      {segs.map((seg, i) => (
        <rect
          key={i}
          x={seg.x} y={seg.isHigh ? HIGH_Y : LOW_Y}
          width={seg.w} height={WIRE_H}
          fill={seg.isHigh ? "rgba(112,104,176,0.18)" : "rgba(6,6,14,0.0)"}
        />
      ))}

      {/* Square-wave line */}
      <polyline
        points={polyStr}
        fill="none"
        stroke="rgba(140,130,210,0.90)"
        strokeWidth={1.8}
        strokeLinejoin="miter"
      />

      {/* Duration labels + bit labels */}
      {segs.map((seg, i) => {
        if (seg.w < 18) return null;
        const midX = seg.x + seg.w / 2;
        const labelY = seg.isHigh ? HIGH_Y - 3 : LOW_Y + WIRE_H + 9;
        const durStr = seg.dur >= 1000
          ? `${(seg.dur / 1000).toFixed(1)}ms`
          : `${Math.round(seg.dur)}µs`;
        return (
          <g key={i}>
            <text x={midX} y={labelY}
              className="ook-az__dur-label" textAnchor="middle">
              {durStr}
            </text>
            {seg.bit !== undefined && seg.w >= 24 && (
              <text x={midX} y={HIGH_Y + WIRE_H / 2 + 4}
                className="ook-az__bit-label" textAnchor="middle">
                {seg.bit}
              </text>
            )}
          </g>
        );
      })}

      {/* HIGH / LOW labels */}
      <text x={4} y={HIGH_Y + 12} className="ook-az__level-label">HI</text>
      <text x={4} y={LOW_Y + 12} className="ook-az__level-label">LO</text>
    </svg>
  );
}

export function OokAnalyzerApp() {
  const [pulses, setPulses] = useState<PulseEvent[]>([]);
  const [freqHz, setFreqHz] = useState(433_920_000);
  const [lnaGain, setLnaGain] = useState(40);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const p = listen<PulseEvent>("pulse_event", (e) => {
      setPulses((prev) => [e.payload, ...prev].slice(0, MAX_STORED));
    });
    return () => { p.then((fn) => fn()); };
  }, []);

  const handleStart = useCallback(async () => {
    setPulses([]);
    await startApp("ook_analyzer" as AppId, {
      center_hz: freqHz,
      lna_gain_db: lnaGain,
      vga_gain_db: 20,
      amp_enabled: false,
    });
    setRunning(true);
  }, [freqHz, lnaGain]);

  const handleStop = useCallback(async () => {
    await stopApp();
    setRunning(false);
  }, []);

  // Metrics
  const highPulses = pulses.filter((p) => p.is_high);
  const durs = highPulses.map((p) => p.duration_us);
  const minDur = durs.length ? Math.min(...durs) : 0;
  const maxDur = durs.length ? Math.max(...durs) : 0;
  const medDur = median(durs);
  const baudEst = medDur > 0 ? Math.round(1_000_000 / medDur) : 0;

  // Inferred bit string from displayed HIGH pulses
  const displayedHigh = pulses.slice(0, N_DISPLAY).filter((p) => p.is_high);
  const bitStr = displayedHigh
    .map((p) => inferBit(p.duration_us, medDur))
    .join(" ");

  return (
    <AppScreen
      appId="ook_analyzer"
      title="OOK Analyzer"
      subtitle={`${(freqHz / 1e6).toFixed(3)} MHz · logic trace`}
      status={running ? "live" : pulses.length > 0 ? "empty" : "idle"}
      statusText={running ? `Capturing · ${pulses.length} pulses` : pulses.length > 0 ? `${pulses.length} pulses` : "Idle"}
    >
      {/* Controls */}
      <div className="ook-az__controls">
        <div className="ook-az__field">
          <label className="ook-az__field-label">Frequency</label>
          <div className="ook-az__input-wrap">
            <input
              className="ook-az__input"
              type="number"
              value={freqHz / 1e6}
              step={0.001}
              onChange={(e) => setFreqHz(Math.round((parseFloat(e.target.value) || 0) * 1e6))}
            />
            <span className="ook-az__input-suffix">MHz</span>
          </div>
        </div>
        <div className="ook-az__field">
          <label className="ook-az__field-label">LNA {lnaGain} dB</label>
          <input type="range" min={0} max={40} value={lnaGain}
            className="ook-az__slider"
            onChange={(e) => setLnaGain(+e.target.value)} />
        </div>
        <div className="ook-az__actions">
          <button className={`ook-az__btn ook-az__btn--start${running ? " ook-az__btn--off" : ""}`}
            onClick={handleStart} disabled={running}>▶ Capture</button>
          <button className={`ook-az__btn ook-az__btn--stop${!running ? " ook-az__btn--off" : ""}`}
            onClick={handleStop} disabled={!running}>■ Stop</button>
          <button className="ook-az__btn ook-az__btn--clear" onClick={() => setPulses([])}>Clear</button>
        </div>
      </div>

      {/* Pulse trace hero */}
      <GlassPanel title={`Pulse Trace · last ${Math.min(pulses.length, N_DISPLAY)} of ${pulses.length} pulses`}
        size="fill" pad="sm" className="ook-az__trace-panel">
        {pulses.length === 0 ? (
          <div className="ook-az__empty">No pulses — tune to an OOK source and press ▶ Capture</div>
        ) : (
          <PulseTrace pulses={pulses} />
        )}
      </GlassPanel>

      {/* Stats + bit pattern */}
      <div className="ook-az__stats-row">
        <GlassPanel title="Timing Stats" pad="md" className="ook-az__stats-panel">
          <div className="ook-az__stat-grid">
            {[
              { k: "Pulses",   v: pulses.length.toString() },
              { k: "Min HIGH", v: minDur > 0 ? `${minDur.toFixed(0)} µs` : "—" },
              { k: "Max HIGH", v: maxDur > 0 ? `${maxDur.toFixed(0)} µs` : "—" },
              { k: "Median",   v: medDur > 0 ? `${medDur.toFixed(0)} µs` : "—" },
              { k: "Est. Rate",v: baudEst > 0 ? `~${baudEst.toLocaleString()} Bd` : "—" },
            ].map(({ k, v }) => (
              <div key={k} className="ook-az__stat">
                <span className="ook-az__stat-key">{k}</span>
                <span className="ook-az__stat-val">{v}</span>
              </div>
            ))}
          </div>
        </GlassPanel>

        <GlassPanel title="Inferred Bits (HIGH pulses, short=0 long=1)" pad="md" className="ook-az__bits-panel">
          {bitStr ? (
            <div className="ook-az__bit-str">{bitStr}</div>
          ) : (
            <div className="ook-az__empty-bits">—</div>
          )}
        </GlassPanel>
      </div>

      <RecordBar
        appId={"ook_analyzer" as Parameters<typeof RecordBar>[0]["appId"]}
        format="jsonl"
        centerHz={freqHz}
      />
    </AppScreen>
  );
}
