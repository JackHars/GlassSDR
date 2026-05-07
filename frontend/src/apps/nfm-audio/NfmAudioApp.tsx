import { useEffect, useState } from "react";
import { Waterfall } from "../../components/Waterfall";
import { AudioSink } from "../../components/AudioSink";
import { RecordBar } from "../../components/RecordBar";
import { AppShell, ControlField, ControlRow } from "../../components/AppShell";
import { FrequencyInput } from "../../components/FrequencyInput";
import { startNfm, stopApp } from "../../ipc/commands";
import { onSpectrum, onAudio, onAppStatus } from "../../ipc/events";
import { useStore } from "../../store";
import type { SpectrumFrame } from "../../ipc/types/SpectrumFrame";
import type { AudioFrame } from "../../ipc/types/AudioFrame";
import type { NfmTuning } from "../../ipc/types/NfmTuning";

const DEFAULT_TUNING: NfmTuning = {
  center_hz: 162_550_000.0,
  lna_gain_db: 24,
  vga_gain_db: 30,
  amp_enabled: false,
  squelch_db: -80,
};

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
    if (running) {
      await stopApp();
      await startNfm(next);
    }
  };

  return (
    <AppShell
      title="NFM Receiver"
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
          <ControlField label={`Squelch ${tuning.squelch_db} dB`} size="md">
            <input type="range" min={-100} max={-20} step={1} value={tuning.squelch_db}
              onChange={(e) => setTuning({ ...tuning, squelch_db: +e.target.value })} />
          </ControlField>
        </ControlRow>
      }
      footer={
        <>
          <AudioSink frame={audio} />
          <RecordBar appId={"nfm_audio" as any} format="wav" centerHz={tuning.center_hz} />
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
        freqStep={12_500}
      />
    </AppShell>
  );
}
