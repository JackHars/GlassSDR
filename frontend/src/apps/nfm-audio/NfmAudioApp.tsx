import { useEffect, useState } from "react";
import { Waterfall } from "../../components/Waterfall";
import { TuningControls } from "../../components/TuningControls";
import { AudioSink } from "../../components/AudioSink";
import { startNfm, stopApp } from "../../ipc/commands";
import { onSpectrum, onAudio, onAppStatus } from "../../ipc/events";
import { useStore } from "../../store";
import type { SpectrumFrame } from "../../ipc/types/SpectrumFrame";
import type { AudioFrame } from "../../ipc/types/AudioFrame";
import type { NfmTuning } from "../../ipc/types/NfmTuning";

const DEFAULT_TUNING: NfmTuning = {
  center_hz: 162_550_000.0, // NOAA weather radio is a reliable test target
  lna_gain_db: 24,
  vga_gain_db: 30,
  amp_enabled: false,
  squelch_db: -80,
};

export function NfmAudioApp() {
  const [spec, setSpec] = useState<SpectrumFrame | null>(null);
  const [audio, setAudio] = useState<AudioFrame | null>(null);
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

  const onApply = async (t: NfmTuning) => {
    if (running) await stopApp();
    await startNfm(t);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <TuningControls initial={DEFAULT_TUNING} onApply={onApply} running={running} />
      <Waterfall width={1024} height={300} frame={spec} />
      <AudioSink frame={audio} />
      <button onClick={() => stopApp()} disabled={!running}>
        Stop
      </button>
      <pre style={{ color: "#888" }}>{JSON.stringify(status, null, 2)}</pre>
    </div>
  );
}
