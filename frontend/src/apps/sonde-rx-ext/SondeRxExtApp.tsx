import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";
import { RecordBar } from "../../components/RecordBar";
import { AppShell, ControlField, ControlRow } from "../../components/AppShell";
import { DecoderTable } from "../../components/DecoderTable";

interface SondeEvent { serial: string; lat: number; lon: number; alt_m: number; sonde_type: string; }

export function SondeRxExtApp() {
  const [freq, setFreq] = useState(403_000_000);
  const [frames, setFrames] = useState<SondeEvent[]>([]);
  const [running, setRunning] = useState(false);

  const handleStart = async () => {
    await startApp("sonde_rx_ext" as AppId, { center_hz: freq, lna_gain_db: 32, vga_gain_db: 20, amp_enabled: false });
    setRunning(true);
  };
  const handleStop = async () => { await stopApp(); setRunning(false); };

  useEffect(() => {
    const unlisten = listen<SondeEvent>("sonde_telemetry", (e) =>
      setFrames((prev) => [e.payload, ...prev].slice(0, 200))
    );
    return () => { unlisten.then((f) => f()); };
  }, []);

  return (
    <AppShell
      title="Radiosonde Extended"
      status={running ? <><span style={{color: "#34C759"}}>●</span> Listening · {frames.length} frames</> : <><span style={{color: "#999"}}>○</span> Idle</>}
      controls={
        <ControlRow
          actions={
            <>
              <button className="glass-btn primary" onClick={handleStart} disabled={running}>Start</button>
              <button className="glass-btn" onClick={handleStop} disabled={!running}>Stop</button>
              <button className="glass-btn" onClick={() => setFrames([])}>Clear</button>
            </>
          }
        >
          <ControlField label="Frequency (Hz)" size="lg">
            <input type="number" value={freq} onChange={(e) => setFreq(Number(e.target.value))} />
          </ControlField>
        </ControlRow>
      }
      footer={<RecordBar appId={"sonde_rx_ext" as any} format="jsonl" centerHz={freq} />}
    >
      <DecoderTable
        headers={["Serial", "Type", "Lat", "Lon", "Alt (m)"]}
        rows={frames}
        renderRow={(f) => [f.serial, f.sonde_type, f.lat.toFixed(5), f.lon.toFixed(5), f.alt_m.toFixed(1)]}
        emptyMessage="No telemetry yet — extended decoder adds prediction and burst-altitude estimation."
      />
    </AppShell>
  );
}
