import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";
import { RecordBar } from "../../components/RecordBar";
import { AppShell, ControlField, ControlRow } from "../../components/AppShell";
import { DecoderTable } from "../../components/DecoderTable";

interface AptLineEvent { line_number: number; channel: string; pixels_len: number; }

export function AptRxApp() {
  const [freq, setFreq] = useState(137_912_500);
  const [lines, setLines] = useState<AptLineEvent[]>([]);
  const [running, setRunning] = useState(false);

  const handleStart = async () => {
    await startApp("apt_rx" as AppId, { center_hz: freq, lna_gain_db: 32, vga_gain_db: 20, amp_enabled: false });
    setRunning(true);
  };
  const handleStop = async () => { await stopApp(); setRunning(false); };

  useEffect(() => {
    const unlisten = listen<AptLineEvent>("apt_line", (e) =>
      setLines((prev) => [e.payload, ...prev].slice(0, 200))
    );
    return () => { unlisten.then((f) => f()); };
  }, []);

  return (
    <AppShell
      title="NOAA APT"
      status={running ? <><span style={{color: "#34C759"}}>●</span> Decoding · {lines.length} lines</> : <><span style={{color: "#999"}}>○</span> Idle · 137 MHz polar orbiters</>}
      controls={
        <ControlRow
          actions={
            <>
              <button className="glass-btn primary" onClick={handleStart} disabled={running}>Start</button>
              <button className="glass-btn" onClick={handleStop} disabled={!running}>Stop</button>
              <button className="glass-btn" onClick={() => setLines([])}>Clear</button>
            </>
          }
        >
          <ControlField label="Frequency (Hz)" size="lg">
            <input type="number" value={freq} onChange={(e) => setFreq(Number(e.target.value))} />
          </ControlField>
        </ControlRow>
      }
      footer={<RecordBar appId={"apt_rx" as any} format="img" centerHz={freq} />}
    >
      <DecoderTable
        headers={["Line #", "Channel", "Pixels"]}
        rows={lines}
        renderRow={(l) => [l.line_number, l.channel, l.pixels_len]}
        emptyMessage="No image lines yet — APT broadcasts arrive line-by-line during a satellite pass (NOAA 15/18/19)."
      />
    </AppShell>
  );
}
