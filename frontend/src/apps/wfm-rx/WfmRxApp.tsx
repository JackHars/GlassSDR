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

interface WfmTuning {
  center_hz: number;
  lna_gain_db: number;
  vga_gain_db: number;
  amp_enabled: boolean;
  stereo: boolean;
}

// Default to the middle of the FM broadcast band (88–108 MHz).
// LNA 32 / VGA 30 / amp off is a clean broadcast-FM gain stack.
const DEFAULT: WfmTuning = {
  center_hz: 98_000_000,
  lna_gain_db: 32,
  vga_gain_db: 30,
  amp_enabled: false,
  stereo: true,
};

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
    await startApp("wfm_rx" as any, tuning);
  };

  const handleTune = async (freqHz: number) => {
    const next = { ...tuning, center_hz: freqHz };
    setTuning(next);
    if (running) {
      await stopApp();
      await startApp("wfm_rx" as any, next);
    }
  };

  return (
    <AppShell
      title="Wideband FM"
      status={running ? <><span style={{color: "#34C759"}}>●</span> Running</> : <><span style={{color: "#999"}}>○</span> Idle</>}
      controls={
        <ControlRow
          actions={
            <>
              <button className="glass-btn primary" onClick={apply}>
                {running ? "Retune" : "Start"}
              </button>
              <button className="glass-btn" onClick={() => stopApp()} disabled={!running}>Stop</button>
            </>
          }
        >
          <ControlField label="Frequency" size="lg">
            <FrequencyInput hz={tuning.center_hz} onChange={(hz) => setTuning({ ...tuning, center_hz: hz })} defaultUnit="MHz" />
          </ControlField>
          <ControlField label={`LNA ${tuning.lna_gain_db} dB`} size="md">
            <input type="range" min={0} max={40} step={8} value={tuning.lna_gain_db}
              onChange={(e) => setTuning({ ...tuning, lna_gain_db: +e.target.value })} />
          </ControlField>
          <ControlField label={`VGA ${tuning.vga_gain_db} dB`} size="md">
            <input type="range" min={0} max={62} step={2} value={tuning.vga_gain_db}
              onChange={(e) => setTuning({ ...tuning, vga_gain_db: +e.target.value })} />
          </ControlField>
          <ControlField label="Amp" size="sm">
            <input type="checkbox" checked={tuning.amp_enabled}
              onChange={(e) => setTuning({ ...tuning, amp_enabled: e.target.checked })} />
          </ControlField>
          <ControlField label="Stereo" size="sm">
            <input type="checkbox" checked={tuning.stereo}
              onChange={(e) => setTuning({ ...tuning, stereo: e.target.checked })} />
          </ControlField>
        </ControlRow>
      }
      footer={
        <>
          <AudioSink frame={audio} />
          <RecordBar appId={"wfm_rx" as any} format="wav" centerHz={tuning.center_hz} />
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
        freqStep={100_000}
      />
    </AppShell>
  );
}
