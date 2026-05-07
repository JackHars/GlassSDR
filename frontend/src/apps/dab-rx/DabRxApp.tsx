import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";
import { RecordBar } from "../../components/RecordBar";
import { AppShell, ControlField, ControlRow } from "../../components/AppShell";
import { DecoderTable } from "../../components/DecoderTable";

interface DabServiceEvent { eid: number; ensemble_label: string; }

export function DabRxApp() {
  const [freq, setFreq] = useState(220_352_000);
  const [services, setServices] = useState<DabServiceEvent[]>([]);
  const [running, setRunning] = useState(false);

  const handleStart = async () => {
    await startApp("dab_rx" as AppId, { center_hz: freq, lna_gain_db: 32, vga_gain_db: 20, amp_enabled: false });
    setRunning(true);
  };
  const handleStop = async () => { await stopApp(); setRunning(false); };

  useEffect(() => {
    const unlisten = listen<DabServiceEvent>("dab_service", (e) =>
      setServices((prev) => [e.payload, ...prev].slice(0, 200))
    );
    return () => { unlisten.then((f) => f()); };
  }, []);

  return (
    <AppShell
      title="DAB Receiver"
      status={running ? <><span style={{color: "#34C759"}}>●</span> Decoding · {services.length} services</> : <><span style={{color: "#999"}}>○</span> Idle</>}
      controls={
        <ControlRow
          actions={
            <>
              <button className="glass-btn primary" onClick={handleStart} disabled={running}>Start</button>
              <button className="glass-btn" onClick={handleStop} disabled={!running}>Stop</button>
              <button className="glass-btn" onClick={() => setServices([])}>Clear</button>
            </>
          }
        >
          <ControlField label="Frequency (Hz)" size="lg">
            <input type="number" value={freq} onChange={(e) => setFreq(Number(e.target.value))} />
          </ControlField>
        </ControlRow>
      }
      footer={<RecordBar appId={"dab_rx" as any} format="jsonl" centerHz={freq} />}
    >
      <DecoderTable
        headers={["EID", "Ensemble"]}
        rows={services}
        renderRow={(s) => [s.eid.toString(16).toUpperCase().padStart(4, "0"), s.ensemble_label]}
        emptyMessage="No DAB ensembles detected — Band III runs 174–240 MHz."
      />
    </AppShell>
  );
}
