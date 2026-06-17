import { useEffect, useMemo, useState } from "react";
import { Waterfall } from "../../components/Waterfall";
import { AudioSink, resumeAudio } from "../../components/AudioSink";
import { RecordBar } from "../../components/RecordBar";
import { FrequencyInput } from "../../components/FrequencyInput";
import { startApp, stopApp } from "../../ipc/commands";
import { onSpectrum, onAudio, onAppStatus } from "../../ipc/events";
import { useStore } from "../../store";
import type { SpectrumFrame } from "../../ipc/types/SpectrumFrame";
import type { AudioFrame } from "../../ipc/types/AudioFrame";
import type { WfmTuning } from "../../ipc/types/WfmTuning";
import { AppScreen } from "../../components/kit/AppScreen";
import "./WfmRx.css";

const DEFAULT: WfmTuning = {
  center_hz: 98_000_000,
  lna_gain_db: 32,
  vga_gain_db: 30,
  amp_enabled: false,
  stereo: true,
};

// Common FM broadcast presets
const PRESETS = [
  { label: "88.1", hz: 88_100_000 },
  { label: "91.9", hz: 91_900_000 },
  { label: "98.0", hz: 98_000_000 },
  { label: "101.1", hz: 101_100_000 },
  { label: "104.3", hz: 104_300_000 },
  { label: "107.1", hz: 107_100_000 },
];

function peakSignal(spec: SpectrumFrame | null): number {
  if (!spec || spec.bins.length === 0) return 0;
  const center = Math.floor(spec.bins.length / 2);
  const half = Math.floor(spec.bins.length * 0.04); // ±4% = ~200kHz band at 2.4M span
  let peak = 0;
  for (let i = center - half; i <= center + half; i++) {
    const b = spec.bins[Math.max(0, Math.min(spec.bins.length - 1, i))];
    if (b > peak) peak = b;
  }
  return peak / 255;
}

function audioLevel(frame: AudioFrame | null): number {
  if (!frame || frame.samples.length === 0) return 0;
  let max = 0;
  for (const s of frame.samples) { const a = Math.abs(s); if (a > max) max = a; }
  return max / 32768;
}

export function WfmRxApp() {
  const [spec, setSpec] = useState<SpectrumFrame | null>(null);
  const [audio, setAudio] = useState<AudioFrame | null>(null);
  const [tuning, setTuning] = useState(DEFAULT);
  const [filterBw, setFilterBw] = useState(200_000);
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

  const apply = async () => {
    resumeAudio();
    if (running) await stopApp();
    await startApp("wfm_rx" as Parameters<typeof startApp>[0], tuning);
  };

  const handleTune = async (freqHz: number) => {
    const next = { ...tuning, center_hz: freqHz };
    setTuning(next);
    if (running) { await stopApp(); await startApp("wfm_rx" as Parameters<typeof startApp>[0], next); }
  };

  const sigLvl = useMemo(() => peakSignal(spec), [spec]);
  const audLvl = useMemo(() => audioLevel(audio), [audio]);
  const hasSignal = running && sigLvl > 0.15;

  return (
    <AppScreen
      appId="wfm_rx"
      title="Wideband FM"
      subtitle={`${(tuning.center_hz / 1e6).toFixed(1)} MHz`}
      status={running ? (hasSignal ? "live" : "acquiring") : "idle"}
      statusText={running ? (hasSignal ? "Signal" : "Scanning") : "Idle"}
      controls={
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "12px 16px", width: "100%" }}>
          {/* Frequency + presets */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label className="app-shell__field-label">Frequency</label>
            <FrequencyInput hz={tuning.center_hz} onChange={(hz) => setTuning({ ...tuning, center_hz: hz })} defaultUnit="MHz" />
            <div className="wfm-presets">
              {PRESETS.map((p) => (
                <button
                  key={p.hz}
                  className={`wfm-preset${tuning.center_hz === p.hz ? " active" : ""}`}
                  onClick={() => handleTune(p.hz)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Gain sliders */}
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
            {/* Stereo toggle */}
            <label style={{ display: "flex", flexDirection: "column", gap: 4, cursor: "pointer" }}>
              <span className="app-shell__field-label">Stereo</span>
              <input type="checkbox" checked={tuning.stereo}
                onChange={(e) => setTuning({ ...tuning, stereo: e.target.checked })} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, cursor: "pointer" }}>
              <span className="app-shell__field-label">Amp</span>
              <input type="checkbox" checked={tuning.amp_enabled}
                onChange={(e) => setTuning({ ...tuning, amp_enabled: e.target.checked })} />
            </label>
          </div>

          {/* Actions */}
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignSelf: "flex-end" }}>
            <button className="glass-btn primary" onClick={apply}>
              {running ? "Retune" : "Start"}
            </button>
            <button className="glass-btn" onClick={() => stopApp()} disabled={!running}>
              Stop
            </button>
          </div>
        </div>
      }
      footer={
        <>
          <AudioSink frame={audio} />
          <RecordBar appId={"wfm_rx" as Parameters<typeof RecordBar>[0]["appId"]} format="wav" centerHz={tuning.center_hz} />
        </>
      }
    >
      {/* Hero: Waterfall with broadcast-tower waves motif */}
      <div className="wfm-hero-wrap">
        {/* Tower rings motif overlay (active when running + signal) */}
        <div className={`wfm-tower-waves${hasSignal ? " active" : ""}`}>
          <div className="wfm-tower-waves__ring" />
          <div className="wfm-tower-waves__ring" />
          <div className="wfm-tower-waves__ring" />
        </div>

        <Waterfall
          height="fill"
          frame={spec}
          centerHz={spec?.center_hz ?? tuning.center_hz}
          spanHz={spec?.span_hz ?? 2_400_000}
          filterBw={filterBw}
          onTune={handleTune}
          onFilterBwChange={setFilterBw}
          freqStep={100_000}
        />

        {/* Info strip: stereo indicator + RDS area + signal bar */}
        <div className="wfm-info-strip">
          {/* Stereo / Mono pill */}
          <div className={`wfm-stereo-pill wfm-stereo-pill--${tuning.stereo && hasSignal ? "stereo" : "mono"}`}>
            <span className="wfm-stereo-dot" />
            {tuning.stereo && hasSignal ? "STEREO" : "MONO"}
          </div>

          {/* RDS placeholder (wfm_rx does not emit rds_data) */}
          <div className="wfm-rds-area">
            {hasSignal
              ? <span className="wfm-rds-searching">Tune to a station · use RDS Decoder app for metadata</span>
              : <span className="wfm-rds-searching">No signal</span>
            }
          </div>

          {/* Signal level bar */}
          {running && (
            <div className="wfm-signal-bar">
              <span className="wfm-signal-label">RF</span>
              <div className="wfm-signal-track">
                <div className="wfm-signal-fill" style={{ width: `${sigLvl * 100}%` }} />
              </div>
            </div>
          )}
          {running && (
            <div className="wfm-signal-bar">
              <span className="wfm-signal-label">Audio</span>
              <div className="wfm-signal-track">
                <div className="wfm-signal-fill" style={{ width: `${audLvl * 100}%`, opacity: 0.7 }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </AppScreen>
  );
}
