import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";
import { RecordBar } from "../../components/RecordBar";
import { AppShell, ControlField, ControlRow } from "../../components/AppShell";
import { DecoderTable } from "../../components/DecoderTable";

interface EpirbBeaconEvent { hex_id: string; country_code: number; }

export function EpirbRxApp() {
  const [freq, setFreq] = useState(406_028_000);
  const [beacons, setBeacons] = useState<EpirbBeaconEvent[]>([]);
  const [running, setRunning] = useState(false);

  const handleStart = async () => {
    await startApp("epirb_rx" as AppId, { center_hz: freq, lna_gain_db: 32, vga_gain_db: 20, amp_enabled: false });
    setRunning(true);
  };
  const handleStop = async () => { await stopApp(); setRunning(false); };

  useEffect(() => {
    const unlisten = listen<EpirbBeaconEvent>("epirb_beacon", (e) =>
      setBeacons((prev) => [e.payload, ...prev].slice(0, 200))
    );
    return () => { unlisten.then((f) => f()); };
  }, []);

  return (
    <AppShell
      title="EPIRB Receiver"
      status={running ? <><span style={{color: "#34C759"}}>●</span> Monitoring 406 MHz · {beacons.length} beacons</> : <><span style={{color: "#999"}}>○</span> Idle</>}
      controls={
        <ControlRow
          actions={
            <>
              <button className="glass-btn primary" onClick={handleStart} disabled={running}>Start</button>
              <button className="glass-btn" onClick={handleStop} disabled={!running}>Stop</button>
              <button className="glass-btn" onClick={() => setBeacons([])}>Clear</button>
            </>
          }
        >
          <ControlField label="Frequency (Hz)" size="lg">
            <input type="number" value={freq} onChange={(e) => setFreq(Number(e.target.value))} />
          </ControlField>
        </ControlRow>
      }
      footer={<RecordBar appId={"epirb_rx" as any} format="jsonl" centerHz={freq} />}
    >
      <DecoderTable
        headers={["Hex ID", "Country Code"]}
        rows={beacons}
        renderRow={(b) => [b.hex_id, b.country_code]}
        emptyMessage="No distress beacons detected. EPIRB beacons are rare — only triggered in genuine emergencies."
      />
    </AppShell>
  );
}
