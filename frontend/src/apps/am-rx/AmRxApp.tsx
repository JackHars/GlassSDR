import { useEffect, useState } from "react";
import { Waterfall } from "../../components/Waterfall";
import { AudioSink, resumeAudio } from "../../components/AudioSink";
import { RecordBar } from "../../components/RecordBar";
import { AppShell, ControlField, ControlRow } from "../../components/AppShell";
import { FrequencyInput } from "../../components/FrequencyInput";
import { startApp, stopApp } from "../../ipc/commands";
import { onSpectrum, onAudio, onAppStatus } from "../../ipc/events";
import { useStore } from "../../store";
import type { SpectrumFrame } from "../../ipc/types/SpectrumFrame";
import type { AudioFrame } from "../../ipc/types/AudioFrame";

interface AmTuning {
  center_hz: number;
  lna_gain_db: number;
  vga_gain_db: number;
  amp_enabled: boolean;
  bandwidth_hz: number;
}

const DEFAULT: AmTuning = {
  center_hz: 7_200_000,
  lna_gain_db: 24,
  vga_gain_db: 20,
  amp_enabled: false,
  bandwidth_hz: 5_000,
};

export function AmRxApp() {
  const [spec, setSpec] = useState<SpectrumFrame | null>(null);
  const [audio, setAudio] = useState<AudioFrame | null>(null);
  const [tuning, setTuning] = useState<AmTuning>(DEFAULT);
  const [filterBw, setFilterBw] = useState(DEFAULT.bandwidth_hz);
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

  const startWith = async (t: AmTuning) => {
    resumeAudio();
    setTuning(t);
    if (running) await stopApp();
    await startApp("am_rx" as any, t);
  };

  const handleTune = async (freqHz: number) => {
    const next = { ...tuning, center_hz: freqHz };
    setTuning(next);
    if (running) {
      await stopApp();
      await startApp("am_rx" as any, next);
    }
  };

  return (
    <AppShell
      title="AM Receiver"
      status={running ? <><span style={{color: "#34C759"}}>●</span> Running</> : <><span style={{color: "#999"}}>○</span> Idle</>}
      controls={
        <ControlRow
          actions={
            <>
              <button className="glass-btn primary" onClick={() => startWith(tuning)}>
                {running ? "Retune" : "Start"}
              </button>
              <button className="glass-btn" onClick={() => stopApp()} disabled={!running}>
                Stop
              </button>
            </>
          }
        >
          <ControlField label="Frequency" size="lg">
            <FrequencyInput hz={tuning.center_hz} onChange={(hz) => setTuning({ ...tuning, center_hz: hz })} autoUnit />
          </ControlField>
          <ControlField label={`LNA ${tuning.lna_gain_db} dB`} size="md">
            <input type="range" min={0} max={40} step={8} value={tuning.lna_gain_db}
              onChange={(e) => setTuning({ ...tuning, lna_gain_db: +e.target.value })} />
          </ControlField>
          <ControlField label={`VGA ${tuning.vga_gain_db} dB`} size="md">
            <input type="range" min={0} max={62} step={2} value={tuning.vga_gain_db}
              onChange={(e) => setTuning({ ...tuning, vga_gain_db: +e.target.value })} />
          </ControlField>
          <ControlField label="Bandwidth (Hz)" size="md">
            <input type="number" value={tuning.bandwidth_hz}
              onChange={(e) => setTuning({ ...tuning, bandwidth_hz: +e.target.value })} />
          </ControlField>
        </ControlRow>
      }
      footer={
        <>
          <AudioSink frame={audio} />
          <RecordBar appId={"am_rx" as any} format="wav" centerHz={tuning.center_hz} />
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
        freqStep={1_000}
      />
    </AppShell>
  );
}
