import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";
import { RecordBar } from "../../components/RecordBar";
import { AppShell, ControlField, ControlRow } from "../../components/AppShell";
import { DecoderTable } from "../../components/DecoderTable";

interface TwoToneEvent { tone_a_hz: number; tone_b_hz: number; timestamp_ms: number; }

export function TwoToneRxApp() {
  const [freq, setFreq] = useState(154_400_000);
  const [alerts, setAlerts] = useState<TwoToneEvent[]>([]);
  const [running, setRunning] = useState(false);

  const handleStart = async () => {
    await startApp("two_tone_rx" as AppId, { center_hz: freq, lna_gain_db: 32, vga_gain_db: 20, amp_enabled: false });
    setRunning(true);
  };
  const handleStop = async () => { await stopApp(); setRunning(false); };

  useEffect(() => {
    const unlisten = listen<TwoToneEvent>("two_tone_alert", (e) =>
      setAlerts((prev) => [e.payload, ...prev].slice(0, 200))
    );
    return () => { unlisten.then((f) => f()); };
  }, []);

  return (
    <AppShell
      title="Two-Tone Pager"
      status={running ? <><span style={{color: "#34C759"}}>●</span> Listening · {alerts.length} alerts</> : <><span style={{color: "#999"}}>○</span> Idle</>}
      controls={
        <ControlRow
          actions={
            <>
              <button className="glass-btn primary" onClick={handleStart} disabled={running}>Start</button>
              <button className="glass-btn" onClick={handleStop} disabled={!running}>Stop</button>
              <button className="glass-btn" onClick={() => setAlerts([])}>Clear</button>
            </>
          }
        >
          <ControlField label="Frequency (Hz)" size="lg">
            <input type="number" value={freq} onChange={(e) => setFreq(Number(e.target.value))} />
          </ControlField>
        </ControlRow>
      }
      footer={<RecordBar appId={"two_tone_rx" as any} format="jsonl" centerHz={freq} />}
    >
      <DecoderTable
        headers={["Tone A (Hz)", "Tone B (Hz)", "Timestamp"]}
        rows={alerts}
        renderRow={(a) => [a.tone_a_hz.toFixed(1), a.tone_b_hz.toFixed(1), new Date(a.timestamp_ms).toISOString()]}
        emptyMessage="No alerts yet — two-tone sequences will appear here when detected."
      />
    </AppShell>
  );
}
