import { useEffect, useState, useCallback, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import { AppScreen } from "../../components/kit/AppScreen";
import { GlassPanel } from "../../components/kit/GlassPanel";
import { RecordBar } from "../../components/RecordBar";
import type { AppId } from "../../ipc/types/AppId";
import "./SubGhzCapture.css";

interface PulseEvent {
  is_high: boolean;
  duration_us: number;
}

const COMMON_FREQS = [
  { label: "315 MHz",    hz: 315_000_000 },
  { label: "433.92 MHz", hz: 433_920_000 },
  { label: "868 MHz",    hz: 868_000_000 },
  { label: "915 MHz",    hz: 915_000_000 },
];

const N_DISPLAY = 80; // pulses visible in the stream strip

/** Scrolling pulse timeline — HI/LO segments proportional to duration. */
function PulseStream({ pulses }: { pulses: PulseEvent[] }) {
  const display = pulses.slice(0, N_DISPLAY);
  if (display.length === 0) {
    return (
      <div className="sgc__stream-empty">
        No pulses — start capture and trigger an OOK transmitter
      </div>
    );
  }

  const totalUs = display.reduce((s, p) => s + p.duration_us, 0) || 1;
  const W = 640;
  const H = 60;
  const HIGH_Y = 8;
  const LOW_Y = 36;
  const PULSE_H = 18;

  let curX = 0;
  const segs = display.map((p) => {
    const w = Math.max(1, (p.duration_us / totalUs) * W);
    const seg = { x: curX, w, isHigh: p.is_high, dur: p.duration_us };
    curX += w;
    return seg;
  });

  // Square-wave polyline
  const pts: [number, number][] = [];
  segs.forEach((seg, i) => {
    const y = seg.isHigh ? HIGH_Y : LOW_Y;
    if (i === 0) pts.push([0, y]);
    else {
      const prevY = segs[i - 1].isHigh ? HIGH_Y : LOW_Y;
      if (prevY !== y) { pts.push([seg.x, prevY]); pts.push([seg.x, y]); }
    }
    pts.push([seg.x + seg.w, y]);
  });
  const polyStr = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

  const totalMs = (totalUs / 1000).toFixed(1);

  return (
    <div className="sgc__stream-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="sgc__stream-svg" preserveAspectRatio="none"
        aria-label="Live pulse stream">
        <rect width={W} height={H} fill="rgba(6,10,24,0.55)" />
        {/* Segment fills */}
        {segs.map((seg, i) => (
          <rect key={i} x={seg.x} y={seg.isHigh ? HIGH_Y : LOW_Y}
            width={seg.w} height={PULSE_H}
            fill={seg.isHigh ? "rgba(88,120,176,0.22)" : "rgba(0,0,0,0)"}
          />
        ))}
        {/* Waveform */}
        <polyline points={polyStr} fill="none"
          stroke="rgba(120,160,230,0.88)" strokeWidth={1.6} strokeLinejoin="miter" />
        {/* Level labels */}
        <text x={4} y={HIGH_Y + 12} className="sgc__level-lbl">HI</text>
        <text x={4} y={LOW_Y + 12} className="sgc__level-lbl">LO</text>
        {/* Time axis */}
        <line x1={0} y1={H - 8} x2={W} y2={H - 8}
          stroke="rgba(88,120,176,0.25)" strokeWidth={0.6} />
        <text x={4} y={H - 1} className="sgc__time-lbl">0</text>
        <text x={W - 4} y={H - 1} className="sgc__time-lbl" textAnchor="end">{totalMs} ms</text>
      </svg>
    </div>
  );
}

interface SessionCapture {
  id: number;
  freq_hz: number;
  started: Date;
  pulseCount: number;
}

let _capId = 0;

export function SubGhzCaptureApp() {
  const [pulses, setPulses] = useState<PulseEvent[]>([]);
  const [freqHz, setFreqHz] = useState(433_920_000);
  const [lnaGain, setLnaGain] = useState(40);
  const [running, setRunning] = useState(false);
  const [sessionCaptures, setSessionCaptures] = useState<SessionCapture[]>([]);
  const currentCapRef = useRef<SessionCapture | null>(null);

  useEffect(() => {
    const p = listen<PulseEvent>("pulse_event", (e) => {
      setPulses((prev) => [e.payload, ...prev].slice(0, 500));
      if (currentCapRef.current) {
        currentCapRef.current = {
          ...currentCapRef.current,
          pulseCount: currentCapRef.current.pulseCount + 1,
        };
      }
    });
    return () => { p.then((fn) => fn()); };
  }, []);

  const handleStart = useCallback(async () => {
    setPulses([]);
    const cap: SessionCapture = { id: ++_capId, freq_hz: freqHz, started: new Date(), pulseCount: 0 };
    currentCapRef.current = cap;
    await startApp("sub_ghz_capture" as AppId, {
      center_hz: freqHz, lna_gain_db: lnaGain, vga_gain_db: 20, amp_enabled: false,
    });
    setRunning(true);
  }, [freqHz, lnaGain]);

  const handleStop = useCallback(async () => {
    await stopApp();
    setRunning(false);
    if (currentCapRef.current) {
      setSessionCaptures((prev) => [currentCapRef.current!, ...prev].slice(0, 10));
      currentCapRef.current = null;
    }
  }, []);

  const totalUs = pulses.reduce((s, p) => s + p.duration_us, 0);
  const totalMs = (totalUs / 1000).toFixed(1);

  return (
    <AppScreen
      appId="sub_ghz_capture"
      title="Sub-GHz Capture"
      subtitle={`${(freqHz / 1e6).toFixed(3)} MHz · OOK`}
      status={running ? "live" : pulses.length > 0 ? "empty" : "idle"}
      statusText={running
        ? `Capturing · ${pulses.length} pulses · ${totalMs} ms`
        : pulses.length > 0 ? `${pulses.length} pulses captured` : "Idle"}
    >
      {/* Controls */}
      <div className="sgc__controls">
        <div className="sgc__freq-btns">
          {COMMON_FREQS.map((f) => (
            <button key={f.hz}
              className={`sgc__freq-btn${f.hz === freqHz ? " sgc__freq-btn--sel" : ""}`}
              onClick={() => setFreqHz(f.hz)}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="sgc__param-row">
          <div className="sgc__field">
            <label className="sgc__field-label">LNA {lnaGain} dB</label>
            <input type="range" min={0} max={40} value={lnaGain}
              className="sgc__slider" onChange={(e) => setLnaGain(+e.target.value)} />
          </div>
          <div className="sgc__actions">
            <button className={`sgc__btn sgc__btn--start${running ? " sgc__btn--off" : ""}`}
              onClick={handleStart} disabled={running}>▶ Capture</button>
            <button className={`sgc__btn sgc__btn--stop${!running ? " sgc__btn--off" : ""}`}
              onClick={handleStop} disabled={!running}>■ Stop</button>
            <button className="sgc__btn sgc__btn--clear" onClick={() => setPulses([])}>Clear</button>
          </div>
        </div>
      </div>

      {/* Live pulse stream hero */}
      <GlassPanel
        title={`Live Pulse Stream · ${pulses.length} pulses · ${totalMs} ms`}
        size="fill"
        pad="sm"
        className="sgc__stream-panel"
      >
        <PulseStream pulses={pulses} />
      </GlassPanel>

      {/* IQ Record Transport — hero capture section */}
      <GlassPanel title="IQ Record Transport" pad="md" className="sgc__record-panel">
        <div className="sgc__record-content">
          <div className="sgc__record-meta">
            <div className="sgc__meta-row">
              <span className="sgc__meta-key">Center</span>
              <span className="sgc__meta-val">{(freqHz / 1e6).toFixed(3)} MHz</span>
            </div>
            <div className="sgc__meta-row">
              <span className="sgc__meta-key">Format</span>
              <span className="sgc__meta-val">cf32 IQ</span>
            </div>
            <div className="sgc__meta-row">
              <span className="sgc__meta-key">Sample rate</span>
              <span className="sgc__meta-val">2 Msps</span>
            </div>
          </div>
          <div className="sgc__record-bar-wrap">
            <RecordBar
              appId={"sub_ghz_capture" as Parameters<typeof RecordBar>[0]["appId"]}
              format="iq"
              centerHz={freqHz}
            />
          </div>
        </div>
      </GlassPanel>

      {/* Session captures log */}
      {sessionCaptures.length > 0 && (
        <GlassPanel title={`Session Captures · ${sessionCaptures.length}`} pad="none"
          className="sgc__captures-panel">
          <div className="sgc__captures-list">
            <div className="sgc__captures-hdr">
              <span>Freq</span>
              <span>Started</span>
              <span>Pulses</span>
            </div>
            {sessionCaptures.map((cap) => (
              <div key={cap.id} className="sgc__capture-row">
                <span className="sgc__cap-freq">{(cap.freq_hz / 1e6).toFixed(3)} MHz</span>
                <span className="sgc__cap-time">
                  {cap.started.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
                <span className="sgc__cap-pulses">{cap.pulseCount}</span>
              </div>
            ))}
          </div>
        </GlassPanel>
      )}
    </AppScreen>
  );
}
