import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";
import { RecordBar } from "../../components/RecordBar";
import { AppShell, ControlField, ControlRow } from "../../components/AppShell";
import { DecoderTable } from "../../components/DecoderTable";

interface FlexPageEvent { capcode: number; message: string; cycle: number; frame: number; }

export function FlexRxApp() {
  const [freq, setFreq] = useState(931_762_500);
  const [pages, setPages] = useState<FlexPageEvent[]>([]);
  const [running, setRunning] = useState(false);

  const handleStart = async () => {
    await startApp("flex_rx" as AppId, { center_hz: freq, lna_gain_db: 32, vga_gain_db: 20, amp_enabled: false });
    setRunning(true);
  };
  const handleStop = async () => { await stopApp(); setRunning(false); };

  useEffect(() => {
    const unlisten = listen<FlexPageEvent>("flex_page", (e) =>
      setPages((prev) => [e.payload, ...prev].slice(0, 200))
    );
    return () => { unlisten.then((f) => f()); };
  }, []);

  return (
    <AppShell
      title="FLEX Pager Receiver"
      status={running ? <><span style={{color: "#34C759"}}>●</span> Listening · {pages.length} pages</> : <><span style={{color: "#999"}}>○</span> Idle</>}
      controls={
        <ControlRow
          actions={
            <>
              <button className="glass-btn primary" onClick={handleStart} disabled={running}>Start</button>
              <button className="glass-btn" onClick={handleStop} disabled={!running}>Stop</button>
              <button className="glass-btn" onClick={() => setPages([])}>Clear</button>
            </>
          }
        >
          <ControlField label="Frequency (Hz)" size="lg">
            <input type="number" value={freq} onChange={(e) => setFreq(Number(e.target.value))} />
          </ControlField>
        </ControlRow>
      }
      footer={<RecordBar appId={"flex_rx" as any} format="jsonl" centerHz={freq} />}
    >
      <DecoderTable
        headers={["Capcode", "Cycle", "Frame", "Message"]}
        rows={pages}
        renderRow={(p) => [p.capcode, p.cycle, p.frame, <span style={{ color: "var(--text-secondary)" }}>{p.message}</span>]}
        emptyMessage="No pages yet — common FLEX bands include 929 MHz."
      />
    </AppShell>
  );
}
