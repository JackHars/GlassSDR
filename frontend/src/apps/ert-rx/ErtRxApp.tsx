import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";
import { RecordBar } from "../../components/RecordBar";
import { AppShell, ControlField, ControlRow } from "../../components/AppShell";
import { DecoderTable } from "../../components/DecoderTable";

interface ErtMeterEvent { meter_id: number; meter_type: string; consumption: number; }

export function ErtRxApp() {
  const [freq, setFreq] = useState(912_600_000);
  const [meters, setMeters] = useState<ErtMeterEvent[]>([]);
  const [running, setRunning] = useState(false);

  const handleStart = async () => {
    await startApp("ert_rx" as AppId, { center_hz: freq, lna_gain_db: 32, vga_gain_db: 20, amp_enabled: false });
    setRunning(true);
  };
  const handleStop = async () => { await stopApp(); setRunning(false); };

  useEffect(() => {
    const unlisten = listen<ErtMeterEvent>("ert_meter", (e) =>
      setMeters((prev) => [e.payload, ...prev].slice(0, 200))
    );
    return () => { unlisten.then((f) => f()); };
  }, []);

  return (
    <AppShell
      title="ERT Meter Receiver"
      status={running ? <><span style={{color: "#34C759"}}>●</span> Listening · {meters.length} readings</> : <><span style={{color: "#999"}}>○</span> Idle</>}
      controls={
        <ControlRow
          actions={
            <>
              <button className="glass-btn primary" onClick={handleStart} disabled={running}>Start</button>
              <button className="glass-btn" onClick={handleStop} disabled={!running}>Stop</button>
              <button className="glass-btn" onClick={() => setMeters([])}>Clear</button>
            </>
          }
        >
          <ControlField label="Frequency (Hz)" size="lg">
            <input type="number" value={freq} onChange={(e) => setFreq(Number(e.target.value))} />
          </ControlField>
        </ControlRow>
      }
      footer={<RecordBar appId={"ert_rx" as any} format="jsonl" centerHz={freq} />}
    >
      <DecoderTable
        headers={["Meter ID", "Type", "Consumption"]}
        rows={meters}
        renderRow={(m) => [m.meter_id, m.meter_type, m.consumption]}
        emptyMessage="No meter readings yet — listening on 915 MHz ISM band."
      />
    </AppShell>
  );
}
