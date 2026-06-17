import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Waterfall } from "../../components/Waterfall";
import { AudioSink, resumeAudio } from "../../components/AudioSink";
import { RecordBar } from "../../components/RecordBar";
import { FrequencyInput } from "../../components/FrequencyInput";
import { startApp, stopApp } from "../../ipc/commands";
import { onSpectrum, onAudio, onAppStatus } from "../../ipc/events";
import { useStore } from "../../store";
import type { SpectrumFrame } from "../../ipc/types/SpectrumFrame";
import type { AudioFrame } from "../../ipc/types/AudioFrame";
import { AppScreen } from "../../components/kit/AppScreen";
import type { AppStatus } from "../../components/kit/AppScreen";
import "./CwRx.css";

interface CwTuning {
  center_hz: number;
  lna_gain_db: number;
  vga_gain_db: number;
  amp_enabled: boolean;
  bfo_hz: number;
  bandwidth_hz: number;
  sideband: string;
}

const DEFAULT: CwTuning = {
  center_hz: 7_030_000,
  lna_gain_db: 24,
  vga_gain_db: 20,
  amp_enabled: false,
  bfo_hz: 600,
  bandwidth_hz: 400,
  sideband: "upper",
};

const CW_BANDS = [
  { label: "40m 7.030", hz: 7_030_000 },
  { label: "20m 14.025", hz: 14_025_000 },
  { label: "15m 21.025", hz: 21_025_000 },
  { label: "10m 28.025", hz: 28_025_000 },
];

const ENVELOPE_SAMPLES = 400; // points in rolling buffer

export function CwRxApp() {
  const [spec, setSpec] = useState<SpectrumFrame | null>(null);
  const [audio, setAudio] = useState<AudioFrame | null>(null);
  const [tuning, setTuning] = useState<CwTuning>(DEFAULT);
  const [filterBw, setFilterBw] = useState(DEFAULT.bandwidth_hz);
  const envCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const envBufRef = useRef<number[]>(new Array(ENVELOPE_SAMPLES).fill(0));
  const [keyed, setKeyed] = useState(false);
  const status = useStore((s) => s.status);
  const setStatus = useStore((s) => s.setStatus);
  const running = status.kind === "running" || status.kind === "starting";

  useEffect(() => {
    const u1 = onSpectrum(setSpec);
    const u2 = onAudio(setAudio);
    const u3 = onAppStatus(setStatus);
    return () => {
      u1.then((f) => f());
      u2.then((f) => f());
      u3.then((f) => f());
    };
  }, [setStatus]);

  // Update rolling envelope buffer from audio frame
  const drawEnvelope = useCallback(() => {
    const canvas = envCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const buf = envBufRef.current;
    // Background grid
    ctx.strokeStyle = "rgba(232,139,0,0.08)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const y = (h / 4) * i;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    if (!running || buf.every((v) => v === 0)) {
      ctx.strokeStyle = "rgba(232,139,0,0.2)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, h); ctx.lineTo(w, h);
      ctx.stroke();
      return;
    }

    // Envelope line
    ctx.strokeStyle = "var(--accent)";
    ctx.lineWidth = 1.5;
    ctx.shadowColor = "rgba(232,139,0,0.45)";
    ctx.shadowBlur = 3;
    ctx.beginPath();
    for (let i = 0; i < buf.length; i++) {
      const x = (i / (buf.length - 1)) * w;
      const y = h - buf[i] * (h * 0.9) - 2;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Fill under curve
    ctx.fillStyle = "rgba(232,139,0,0.08)";
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i < buf.length; i++) {
      const x = (i / (buf.length - 1)) * w;
      const y = h - buf[i] * (h * 0.9) - 2;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  }, [running]);

  useEffect(() => {
    if (!audio || !running) { envBufRef.current = new Array(ENVELOPE_SAMPLES).fill(0); drawEnvelope(); return; }
    const samples = audio.samples;
    // Compute per-chunk RMS for this frame (960 samples → ~10 envelope points)
    const chunkSize = Math.floor(samples.length / 10);
    const newPoints: number[] = [];
    for (let i = 0; i < 10; i++) {
      let sum = 0;
      for (let j = 0; j < chunkSize; j++) {
        const s = (samples[i * chunkSize + j] ?? 0) / 32768;
        sum += s * s;
      }
      newPoints.push(Math.sqrt(sum / chunkSize));
    }
    // Shift rolling buffer
    const buf = envBufRef.current;
    buf.splice(0, newPoints.length);
    buf.push(...newPoints);
    // Key indicator: any chunk above threshold
    const keyThreshold = 0.05;
    setKeyed(newPoints.some((v) => v > keyThreshold));
    drawEnvelope();
  }, [audio, running, drawEnvelope]);

  const startWith = async (t: CwTuning) => {
    resumeAudio();
    setTuning(t);
    if (running) await stopApp();
    await startApp("cw_rx" as Parameters<typeof startApp>[0], t);
  };

  const handleTune = async (freqHz: number) => {
    const next = { ...tuning, center_hz: freqHz };
    setTuning(next);
    if (running) { await stopApp(); await startApp("cw_rx" as Parameters<typeof startApp>[0], next); }
  };

  // Signal from spectrum
  const specPeak = useMemo(() => {
    if (!spec || spec.bins.length === 0) return 0;
    const center = Math.floor(spec.bins.length / 2);
    const half = Math.max(1, Math.floor(spec.bins.length * 0.003)); // very narrow for CW
    let peak = 0;
    for (let i = center - half; i <= center + half; i++) {
      const b = spec.bins[Math.max(0, Math.min(spec.bins.length - 1, i))];
      if (b > peak) peak = b;
    }
    return peak / 255;
  }, [spec]);

  const hasSignal = running && specPeak > 0.08;
  const appStatus: AppStatus = running ? (hasSignal ? "live" : "idle") : "idle";

  return (
    <AppScreen
      appId="cw_rx"
      title="CW Receiver"
      subtitle={`${(tuning.center_hz / 1e6).toFixed(4)} MHz · ${tuning.bfo_hz} Hz`}
      status={appStatus}
      statusText={running ? (keyed ? "KEY DOWN" : hasSignal ? "Signal" : "Listening") : "Idle"}
      actions={
        <div className="cw-key-indicator">
          <div className={`cw-key-dot${keyed ? " keyed" : ""}`} />
          <span className="cw-key-label">{keyed ? "−−−" : "· · ·"}</span>
        </div>
      }
      controls={
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "12px 16px", width: "100%" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label className="app-shell__field-label">Frequency</label>
            <FrequencyInput hz={tuning.center_hz} onChange={(hz) => setTuning({ ...tuning, center_hz: hz })} autoUnit />
            <div className="cw-bands">
              {CW_BANDS.map((b) => (
                <button key={b.hz}
                  className={`cw-band${tuning.center_hz === b.hz ? " active" : ""}`}
                  onClick={() => { const t = { ...tuning, center_hz: b.hz }; if (running) startWith(t); else setTuning(t); }}
                >{b.label}</button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label className="app-shell__field-label">LNA {tuning.lna_gain_db} dB</label>
              <input type="range" min={0} max={40} step={8} value={tuning.lna_gain_db}
                onChange={(e) => setTuning({ ...tuning, lna_gain_db: +e.target.value })} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label className="app-shell__field-label">VGA {tuning.vga_gain_db} dB</label>
              <input type="range" min={0} max={62} step={2} value={tuning.vga_gain_db}
                onChange={(e) => setTuning({ ...tuning, vga_gain_db: +e.target.value })} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label className="app-shell__field-label">Pitch {tuning.bfo_hz} Hz</label>
              <input type="range" min={300} max={1000} value={tuning.bfo_hz}
                onChange={(e) => setTuning({ ...tuning, bfo_hz: +e.target.value })} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label className="app-shell__field-label">BW {tuning.bandwidth_hz} Hz</label>
              <input type="range" min={100} max={800} step={50} value={tuning.bandwidth_hz}
                onChange={(e) => { setTuning({ ...tuning, bandwidth_hz: +e.target.value }); setFilterBw(+e.target.value); }} />
            </div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignSelf: "flex-end" }}>
            <button className="glass-btn primary" onClick={() => startWith(tuning)}>{running ? "Retune" : "Start"}</button>
            <button className="glass-btn" onClick={() => stopApp()} disabled={!running}>Stop</button>
          </div>
        </div>
      }
      footer={
        <>
          {/* CW envelope / dit-dah timeline */}
          <div className="cw-envelope" style={{ height: 60 }}>
            <canvas ref={envCanvasRef} width={800} height={60} style={{ width: "100%", height: "100%" }} />
            <span className="cw-envelope__label">Envelope</span>
          </div>
          <AudioSink frame={audio} />
          <RecordBar appId={"cw_rx" as Parameters<typeof RecordBar>[0]["appId"]} format="wav" centerHz={tuning.center_hz} />
        </>
      }
    >
      <Waterfall
        height="fill"
        frame={spec}
        centerHz={spec?.center_hz ?? tuning.center_hz}
        spanHz={spec?.span_hz ?? 2_400_000}
        filterBw={filterBw}
        onTune={handleTune}
        onFilterBwChange={setFilterBw}
        freqStep={100}
      />
    </AppScreen>
  );
}
