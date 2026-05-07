import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";
import { RecordBar } from "../../components/RecordBar";
import { AppShell, ControlRow } from "../../components/AppShell";
import { DecoderTable } from "../../components/DecoderTable";

interface ScanResultEvent { freq_hz: number; power_db: number; }

export function LookingGlassApp() {
  const [signals, setSignals] = useState<ScanResultEvent[]>([]);
  const [running, setRunning] = useState(false);

  const handleStart = async () => {
    await startApp("looking_glass" as AppId, {
      start_hz: 1_000_000, stop_hz: 6_000_000_000, step_hz: 1_000_000,
      lna_gain_db: 32, vga_gain_db: 20, amp_enabled: false,
    });
    setRunning(true);
  };
  const handleStop = async () => { await stopApp(); setRunning(false); };

  useEffect(() => {
    const unlisten = listen<ScanResultEvent>("scan_result", (e) =>
      setSignals((prev) => [e.payload, ...prev].slice(0, 2000))
    );
    return () => { unlisten.then((f) => f()); };
  }, []);

  return (
    <AppShell
      title="Looking Glass"
      status={running ? <><span style={{color: "#34C759"}}>●</span> Sweeping 1 MHz – 6 GHz · {signals.length} entries</> : <><span style={{color: "#999"}}>○</span> Idle</>}
      controls={
        <ControlRow
          actions={
            <>
              <button className="glass-btn primary" onClick={handleStart} disabled={running}>Start</button>
              <button className="glass-btn" onClick={handleStop} disabled={!running}>Stop</button>
              <button className="glass-btn" onClick={() => setSignals([])}>Clear</button>
            </>
          }
        >
          <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>
            Wide-band sweep across the entire HackRF range — useful for surveying activity.
          </span>
        </ControlRow>
      }
      footer={<RecordBar appId={"looking_glass" as any} format="jsonl" />}
    >
      <DecoderTable
        headers={["Frequency", "Power (dB)"]}
        rows={signals}
        renderRow={(s) => [
          `${(s.freq_hz / 1e6).toFixed(3)} MHz`,
          <span style={{ color: s.power_db > -60 ? "#34C759" : "var(--text-secondary)" }}>{s.power_db.toFixed(1)}</span>,
        ]}
        emptyMessage="No hits yet — wide sweeps take a few seconds to complete each pass."
      />
    </AppShell>
  );
}
