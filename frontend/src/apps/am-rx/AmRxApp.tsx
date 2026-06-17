import { useEffect, useMemo, useRef, useState } from "react";
import { Waterfall } from "../../components/Waterfall";
import { AudioSink, resumeAudio } from "../../components/AudioSink";
import { RecordBar } from "../../components/RecordBar";
import { FrequencyInput } from "../../components/FrequencyInput";
import { startApp, stopApp } from "../../ipc/commands";
import { onSpectrum, onAudio, onAppStatus } from "../../ipc/events";
import { useStore } from "../../store";
import type { SpectrumFrame } from "../../ipc/types/SpectrumFrame";
import type { AudioFrame } from "../../ipc/types/AudioFrame";
import type { AmTuning } from "../../ipc/types/AmTuning";
import { AppScreen } from "../../components/kit/AppScreen";
import type { AppStatus } from "../../components/kit/AppScreen";
import "./AmRx.css";

const DEFAULT: AmTuning = {
  center_hz: 7_200_000,
  lna_gain_db: 24,
  vga_gain_db: 20,
  amp_enabled: false,
  bandwidth_hz: 5_000,
};

const BAND_PRESETS = [
  { label: "AM 1710", hz: 1_710_000, bw: 10_000, group: "MW" },
  { label: "HF 7.2M", hz: 7_200_000, bw: 5_000, group: "SW" },
  { label: "WWV 10M", hz: 10_000_000, bw: 5_000, group: "SW" },
  { label: "Air 121.5", hz: 121_500_000, bw: 15_000, group: "Air" },
  { label: "Air 243.0", hz: 243_000_000, bw: 15_000, group: "Air" },
];

function carrierLevel(spec: SpectrumFrame | null): number {
  if (!spec || spec.bins.length === 0) return 0;
  const center = Math.floor(spec.bins.length / 2);
  // For narrow AM, look at only ±1% of span around center
  const half = Math.max(1, Math.floor(spec.bins.length * 0.01));
  let peak = 0;
  for (let i = center - half; i <= center + half; i++) {
    const b = spec.bins[Math.max(0, Math.min(spec.bins.length - 1, i))];
    if (b > peak) peak = b;
  }
  return peak / 255;
}

export function AmRxApp() {
  const [spec, setSpec] = useState<SpectrumFrame | null>(null);
  const [audio, setAudio] = useState<AudioFrame | null>(null);
  const [tuning, setTuning] = useState<AmTuning>(DEFAULT);
  const [filterBw, setFilterBw] = useState(DEFAULT.bandwidth_hz);
  const envCanvasRef = useRef<HTMLCanvasElement | null>(null);
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

  // Draw AM envelope from audio samples
  useEffect(() => {
    const canvas = envCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const samples = audio?.samples ?? [];
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    if (samples.length === 0 || !running) {
      // Draw idle flat line
      ctx.strokeStyle = "rgba(200,150,10,0.2)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();
      return;
    }
    // Draw envelope (positive half)
    const step = Math.max(1, Math.floor(samples.length / w));
    ctx.strokeStyle = "var(--accent)";
    ctx.lineWidth = 1.5;
    ctx.shadowColor = "rgba(200,150,10,0.4)";
    ctx.shadowBlur = 4;
    ctx.beginPath();
    for (let x = 0; x < w; x++) {
      let max = 0;
      for (let j = 0; j < step; j++) {
        const s = Math.abs(samples[Math.min(x * step + j, samples.length - 1)] ?? 0);
        if (s > max) max = s;
      }
      const y = h - (max / 32768) * (h * 0.9) - 2;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    // Mirror
    ctx.beginPath();
    for (let x = 0; x < w; x++) {
      let max = 0;
      for (let j = 0; j < step; j++) {
        const s = Math.abs(samples[Math.min(x * step + j, samples.length - 1)] ?? 0);
        if (s > max) max = s;
      }
      const y = (max / 32768) * (h * 0.9) + 2;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }, [audio, running]);

  const startWith = async (t: AmTuning) => {
    resumeAudio();
    if (running) await stopApp();
    await startApp("am_rx" as Parameters<typeof startApp>[0], t);
  };

  const handleTune = async (freqHz: number) => {
    const next = { ...tuning, center_hz: freqHz };
    setTuning(next);
    if (running) { await stopApp(); await startApp("am_rx" as Parameters<typeof startApp>[0], next); }
  };

  const carrier = useMemo(() => carrierLevel(spec), [spec]);
  const hasCarrier = running && carrier > 0.10;
  const appStatus: AppStatus = running ? (hasCarrier ? "live" : "acquiring") : "idle";

  return (
    <AppScreen
      appId="am_rx"
      title="AM Receiver"
      subtitle={
        tuning.center_hz >= 1e6
          ? `${(tuning.center_hz / 1e6).toFixed(4)} MHz`
          : `${(tuning.center_hz / 1e3).toFixed(1)} kHz`
      }
      status={appStatus}
      statusText={running ? (hasCarrier ? "Carrier" : "Searching") : "Idle"}
      controls={
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "12px 16px", width: "100%" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label className="app-shell__field-label">Frequency</label>
            <FrequencyInput hz={tuning.center_hz} onChange={(hz) => setTuning({ ...tuning, center_hz: hz })} autoUnit />
            <div className="am-band-chips">
              {BAND_PRESETS.map((p) => (
                <button
                  key={p.hz}
                  className={`am-band-chip${tuning.center_hz === p.hz ? " active" : ""}`}
                  onClick={() => { const t = { ...tuning, center_hz: p.hz, bandwidth_hz: p.bw }; setTuning(t); setFilterBw(p.bw); if (running) startWith(t); }}
                >
                  {p.label}
                </button>
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
              <label className="app-shell__field-label">BW (Hz)</label>
              <input type="number" value={tuning.bandwidth_hz} style={{ width: 80 }}
                onChange={(e) => { setTuning({ ...tuning, bandwidth_hz: +e.target.value }); setFilterBw(+e.target.value); }} />
            </div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignSelf: "flex-end" }}>
            <button className="glass-btn primary" onClick={() => startWith(tuning)}>
              {running ? "Retune" : "Start"}
            </button>
            <button className="glass-btn" onClick={() => stopApp()} disabled={!running}>Stop</button>
          </div>
        </div>
      }
      footer={
        <>
          {/* AM envelope motif — shows audio envelope waveform */}
          <canvas ref={envCanvasRef} className="am-envelope-canvas" width={800} height={48} />
          <AudioSink frame={audio} />
          <RecordBar appId={"am_rx" as Parameters<typeof RecordBar>[0]["appId"]} format="wav" centerHz={tuning.center_hz} />
        </>
      }
    >
      {/* Hero row: Waterfall + carrier scope */}
      <div className="am-hero-row">
        <Waterfall
          height="fill"
          frame={spec}
          centerHz={spec?.center_hz ?? tuning.center_hz}
          spanHz={spec?.span_hz ?? 2_400_000}
          filterBw={filterBw}
          onTune={handleTune}
          onFilterBwChange={setFilterBw}
          freqStep={1_000}
        />
        {/* Carrier scope */}
        <div className="am-carrier-scope">
          <span className="am-carrier-scope__label">Carrier</span>
          <div className="am-carrier-scope__bar-track">
            <div
              className="am-carrier-scope__bar"
              style={{ height: `${carrier * 100}%` }}
            />
          </div>
          <span className="am-carrier-scope__db">
            {hasCarrier ? `${Math.round(carrier * 100)}%` : "—"}
          </span>
        </div>
      </div>
    </AppScreen>
  );
}
