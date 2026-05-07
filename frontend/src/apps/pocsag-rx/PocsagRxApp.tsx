import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";
import { RecordBar } from "../../components/RecordBar";
import { AppShell, ControlField, ControlRow } from "../../components/AppShell";
import { DecoderTable } from "../../components/DecoderTable";

interface PocsagPageEvent {
  ric: number;
  function: number;
  message: string;
}

export function PocsagRxApp() {
  const [freq, setFreq] = useState("439987500");
  const [pages, setPages] = useState<PocsagPageEvent[]>([]);
  const [running, setRunning] = useState(false);

  const handleStart = async () => {
    await startApp("pocsag_rx" as AppId, { center_hz: parseFloat(freq), lna_gain_db: 32, vga_gain_db: 20, amp_enabled: false });
    setRunning(true);
  };
  const handleStop = async () => { await stopApp(); setRunning(false); };

  useEffect(() => {
    const unlisten = listen<PocsagPageEvent>("pocsag_page", (e) =>
      setPages((prev) => [e.payload, ...prev].slice(0, 200))
    );
    return () => { unlisten.then((f) => f()); };
  }, []);

  return (
    <AppShell
      title="POCSAG Receiver"
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
            <input value={freq} onChange={(e) => setFreq(e.target.value)} />
          </ControlField>
        </ControlRow>
      }
      footer={<RecordBar appId={"pocsag_rx" as any} format="jsonl" centerHz={parseFloat(freq) || undefined} />}
    >
      <DecoderTable
        headers={["RIC", "Function", "Message"]}
        rows={pages}
        renderRow={(p) => [p.ric, p.function, <span style={{ color: "var(--text-secondary)", wordBreak: "break-all" }}>{p.message}</span>]}
        emptyMessage="No pages yet — press Start to listen."
      />
    </AppShell>
  );
}
