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
import type { SsbTuning } from "../../ipc/types/SsbTuning";
import { AppScreen } from "../../components/kit/AppScreen";
import type { AppStatus } from "../../components/kit/AppScreen";
import type { AllAppId } from "../../theme/appThemes";
import "./SsbRx.css";

// Ham-band quick presets
const USB_BANDS = [
  { label: "20m", hz: 14_200_000 },
  { label: "17m", hz: 18_130_000 },
  { label: "15m", hz: 21_300_000 },
  { label: "10m", hz: 28_400_000 },
  { label: "2m", hz: 144_200_000 },
];

const LSB_BANDS = [
  { label: "160m", hz: 1_850_000 },
  { label: "80m", hz: 3_750_000 },
  { label: "40m", hz: 7_150_000 },
  { label: "60m", hz: 5_357_000 },
];

const S_BARS = 10; // S1–S9+

/** Compute S-meter value (0-10) from spectrum peak near center */
function sValue(spec: SpectrumFrame | null): number {
  if (!spec || spec.bins.length === 0) return 0;
  const center = Math.floor(spec.bins.length / 2);
  const half = Math.max(1, Math.floor(spec.bins.length * 0.005));
  let peak = 0;
  for (let i = center - half; i <= center + half; i++) {
    const b = spec.bins[Math.max(0, Math.min(spec.bins.length - 1, i))];
    if (b > peak) peak = b;
  }
  return (peak / 255) * S_BARS;
}

/** Format S-meter as S1-S9 or S9+N */
function sLabel(sv: number): string {
  const s = Math.min(9, Math.round(sv));
  if (sv > 9) return `S9+${Math.round((sv - 9) * 10)} dB`;
  return `S${Math.max(1, s)}`;
}

export function SsbRxApp({ appId, label }: { appId: string; label: string }) {
  const isUsb = appId === "usb_rx";
  const sideband = isUsb ? "upper" : "lower";
  const bands = isUsb ? USB_BANDS : LSB_BANDS;
  const defaultFreq = isUsb ? 14_200_000 : 7_150_000;
  const appIdTyped = appId as AllAppId;

  const [spec, setSpec] = useState<SpectrumFrame | null>(null);
  const [audio, setAudio] = useState<AudioFrame | null>(null);
  const [tuning, setTuning] = useState<SsbTuning>({
    center_hz: defaultFreq,
    lna_gain_db: 24,
    vga_gain_db: 20,
    amp_enabled: false,
    bfo_hz: 1500,
    bandwidth_hz: 2700,
    sideband,
  });
  const [filterBw, setFilterBw] = useState(2700);
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

  const startWith = async (t: SsbTuning) => {
    resumeAudio();
    setTuning(t);
    if (running) await stopApp();
    await startApp(appId as Parameters<typeof startApp>[0], t);
  };

  const handleTune = async (freqHz: number) => {
    const next = { ...tuning, center_hz: freqHz };
    setTuning(next);
    if (running) { await stopApp(); await startApp(appId as Parameters<typeof startApp>[0], next); }
  };

  const sv = useMemo(() => sValue(spec), [spec]);
  const hasSignal = running && sv > 1;
  const appStatus: AppStatus = running ? (hasSignal ? "live" : "idle") : "idle";

  // S-meter bar heights
  const barHeights = Array.from({ length: S_BARS }, (_, i) => {
    const minH = 20 + i * 8; // bars get taller toward S9
    return Math.min(100, minH) + "%";
  });

  return (
    <AppScreen
      appId={appIdTyped}
      title={label}
      subtitle={`${(tuning.center_hz / 1e6).toFixed(4)} MHz · ${isUsb ? "USB" : "LSB"}`}
      status={appStatus}
      statusText={running ? (hasSignal ? sLabel(sv) : "No signal") : "Idle"}
      actions={
        <div className={`ssb-mode-badge ssb-mode-badge--${isUsb ? "usb" : "lsb"}`}>
          {isUsb ? "USB" : "LSB"}
        </div>
      }
      controls={
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "12px 16px", width: "100%" }}>
          {/* Frequency + band chips */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label className="app-shell__field-label">Frequency</label>
            <FrequencyInput hz={tuning.center_hz} onChange={(hz) => setTuning({ ...tuning, center_hz: hz })} autoUnit />
            <div className="ssb-bands">
              {bands.map((b) => (
                <button
                  key={b.hz}
                  className={`ssb-band${tuning.center_hz === b.hz ? " active" : ""}`}
                  onClick={() => { const t = { ...tuning, center_hz: b.hz }; if (running) startWith(t); else setTuning(t); }}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sliders */}
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
              <label className="app-shell__field-label">BFO {tuning.bfo_hz} Hz</label>
              <input type="range" min={0} max={3000} step={50} value={tuning.bfo_hz}
                onChange={(e) => setTuning({ ...tuning, bfo_hz: +e.target.value })} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label className="app-shell__field-label">BW {tuning.bandwidth_hz} Hz</label>
              <input type="range" min={300} max={5000} step={100} value={tuning.bandwidth_hz}
                onChange={(e) => { setTuning({ ...tuning, bandwidth_hz: +e.target.value }); setFilterBw(+e.target.value); }} />
            </div>
          </div>

          {/* Actions */}
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
          <AudioSink frame={audio} />
          <RecordBar appId={appId as Parameters<typeof RecordBar>[0]["appId"]} format="wav" centerHz={tuning.center_hz} />
        </>
      }
    >
      {/* Hero row: Waterfall + S-meter */}
      <div className="ssb-hero-row">
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

        {/* S-meter panel */}
        <div className="ssb-s-meter">
          <span className="ssb-s-meter__label">S-Meter</span>
          <div className="ssb-s-scale">
            {barHeights.map((h, i) => {
              const lit = hasSignal && sv >= i + 1;
              return (
                <div
                  key={i}
                  className={`ssb-s-bar${lit ? " lit" : ""}${i >= 9 && lit ? " over9" : ""}`}
                  style={{ height: h }}
                />
              );
            })}
          </div>
          <span className="ssb-s-reading">{running ? sLabel(sv) : "—"}</span>
        </div>
      </div>
    </AppScreen>
  );
}

// Re-export AudioFrame usage for unlisten type annotation
void ((_: AudioFrame | null) => {});
