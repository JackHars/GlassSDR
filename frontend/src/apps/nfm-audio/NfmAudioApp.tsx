import { useEffect, useMemo, useState } from "react";
import { Waterfall } from "../../components/Waterfall";
import { AudioSink } from "../../components/AudioSink";
import { RecordBar } from "../../components/RecordBar";
import { FrequencyInput } from "../../components/FrequencyInput";
import { startNfm, stopApp } from "../../ipc/commands";
import { onSpectrum, onAudio, onAppStatus } from "../../ipc/events";
import { useStore } from "../../store";
import type { SpectrumFrame } from "../../ipc/types/SpectrumFrame";
import type { AudioFrame } from "../../ipc/types/AudioFrame";
import type { NfmTuning } from "../../ipc/types/NfmTuning";
import { AppScreen } from "../../components/kit/AppScreen";
import type { AppStatus } from "../../components/kit/AppScreen";
import "./NfmAudio.css";

const DEFAULT_TUNING: NfmTuning = {
  center_hz: 162_550_000,
  lna_gain_db: 24,
  vga_gain_db: 30,
  amp_enabled: false,
  squelch_db: -80,
};

// NOAA Weather channel presets (MHz)
const PRESETS = [
  { label: "WX1 162.4", hz: 162_400_000 },
  { label: "WX2 162.425", hz: 162_425_000 },
  { label: "WX3 162.45", hz: 162_450_000 },
  { label: "WX7 162.55", hz: 162_550_000 },
  { label: "Air 121.5", hz: 121_500_000 },
];

function formatFreq(hz: number): string {
  return `${(hz / 1e6).toFixed(4)} MHz`;
}

/** Derive signal level (0-1) from spectrum bins near the center frequency. */
function signalLevel(spec: SpectrumFrame | null): number {
  if (!spec || spec.bins.length === 0) return 0;
  const center = Math.floor(spec.bins.length / 2);
  const half = Math.floor(spec.bins.length * 0.02);
  let peak = 0;
  for (let i = center - half; i <= center + half; i++) {
    const b = spec.bins[Math.max(0, Math.min(spec.bins.length - 1, i))];
    if (b > peak) peak = b;
  }
  return peak / 255;
}

/** Derive RMS from audio samples for VU bars. */
function audioRms(frame: AudioFrame | null): number {
  if (!frame || frame.samples.length === 0) return 0;
  let sum = 0;
  for (const s of frame.samples) sum += (s / 32768) ** 2;
  return Math.sqrt(sum / frame.samples.length);
}

const VU_BAR_COUNT = 20;

export function NfmAudioApp() {
  const [spec, setSpec] = useState<SpectrumFrame | null>(null);
  const [audio, setAudio] = useState<AudioFrame | null>(null);
  const [tuning, setTuning] = useState(DEFAULT_TUNING);
  const [filterBw, setFilterBw] = useState(12_500);
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
    if (running) await stopApp();
    await startNfm(tuning);
  };

  const handleTune = async (freqHz: number) => {
    const next = { ...tuning, center_hz: freqHz };
    setTuning(next);
    if (running) { await stopApp(); await startNfm(next); }
  };

  // Derived signal metrics
  const sigLvl = useMemo(() => signalLevel(spec), [spec]);
  // squelch threshold in 0-1 space (map -100..-20 dB to 0-1 approximately)
  const squelchPct = (tuning.squelch_db - (-100)) / 80;
  const gated = running && sigLvl >= squelchPct;

  // VU bar heights from audio RMS
  const rms = useMemo(() => audioRms(audio), [audio]);
  const vuBars = useMemo(() => {
    const bars: number[] = [];
    for (let i = 0; i < VU_BAR_COUNT; i++) {
      const phase = i / VU_BAR_COUNT;
      // Each bar decays slightly and has a slight random taper
      bars.push(Math.max(2, (rms * (1 - phase * 0.4)) * 100));
    }
    return bars;
  }, [rms]);

  const appStatus: AppStatus = running ? (gated ? "live" : "acquiring") : "idle";
  const statusText = running ? (gated ? "Receiving" : "Squelched") : "Idle";

  return (
    <AppScreen
      appId="nfm_audio"
      title="NFM Receiver"
      subtitle={formatFreq(tuning.center_hz)}
      status={appStatus}
      statusText={statusText}
      controls={
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "12px 16px", width: "100%" }}>
          {/* Frequency + presets */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label className="app-shell__field-label">Frequency</label>
            <FrequencyInput
              hz={tuning.center_hz}
              onChange={(hz) => setTuning({ ...tuning, center_hz: hz })}
              defaultUnit="MHz"
            />
            <div className="nfm-presets">
              {PRESETS.map((p) => (
                <button
                  key={p.hz}
                  className={`nfm-preset${tuning.center_hz === p.hz ? " active" : ""}`}
                  onClick={() => handleTune(p.hz)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Gain sliders */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
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
              <label className="app-shell__field-label">Squelch {tuning.squelch_db} dB</label>
              <input type="range" min={-100} max={-20} step={1} value={tuning.squelch_db}
                onChange={(e) => setTuning({ ...tuning, squelch_db: +e.target.value })} />
            </div>
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
          {/* VU audio bars motif */}
          {running && (
            <div className="nfm-vu">
              {vuBars.map((h, i) => (
                <div key={i} className="nfm-vu__bar" style={{ height: `${h}%` }} />
              ))}
            </div>
          )}
          <AudioSink frame={audio} />
          <RecordBar appId={"nfm_audio" as Parameters<typeof RecordBar>[0]["appId"]} format="wav" centerHz={tuning.center_hz} />
        </>
      }
    >
      {/* Hero row: Waterfall + squelch rail */}
      <div className="nfm-hero-row">
        <Waterfall
          height="fill"
          frame={spec}
          centerHz={spec?.center_hz ?? tuning.center_hz}
          spanHz={spec?.span_hz ?? 2_400_000}
          filterBw={filterBw}
          onTune={handleTune}
          onFilterBwChange={setFilterBw}
          freqStep={12_500}
        />

        {/* Squelch rail */}
        <div className="nfm-squelch-rail">
          <span className="nfm-squelch-rail__db">{tuning.squelch_db}</span>
          <div className="nfm-squelch-rail__track">
            {/* Signal level fill */}
            <div
              className="nfm-squelch-rail__fill"
              style={{
                height: `${sigLvl * 100}%`,
                background: gated
                  ? "linear-gradient(to top, #34C759, var(--accent))"
                  : "linear-gradient(to top, rgba(0,0,0,0.15), var(--accent-dim))",
              }}
            />
            {/* Squelch threshold line */}
            <div
              className="nfm-squelch-rail__threshold"
              style={{ bottom: `${squelchPct * 100}%` }}
            />
          </div>
          <span className="nfm-squelch-rail__label">SQ</span>
        </div>
      </div>
    </AppScreen>
  );
}
