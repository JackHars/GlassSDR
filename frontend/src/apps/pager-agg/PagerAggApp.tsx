import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";
import { RecordBar } from "../../components/RecordBar";
import { AppShell, ControlField, ControlRow } from "../../components/AppShell";
import { DecoderTable } from "../../components/DecoderTable";

interface PocsagPageEvent { ric: number; function: number; message: string; }
interface AggPage { protocol: string; capcode: number; message: string; }

export function PagerAggApp() {
  const [freq, setFreq] = useState("439987500");
  const [pages, setPages] = useState<AggPage[]>([]);
  const [running, setRunning] = useState(false);

  const handleStart = async () => {
    await startApp("pager_aggregator" as AppId, { center_hz: parseFloat(freq), lna_gain_db: 32, vga_gain_db: 20, amp_enabled: false });
    setRunning(true);
  };
  const handleStop = async () => { await stopApp(); setRunning(false); };

  useEffect(() => {
    const unlistenPocsag = listen<PocsagPageEvent>("pocsag_page", (e) => {
      const page: AggPage = { protocol: "POCSAG", capcode: e.payload.ric, message: e.payload.message };
      setPages((prev) => [page, ...prev].slice(0, 400));
    });
    return () => { unlistenPocsag.then((f) => f()); };
  }, []);

  return (
    <AppShell
      title="Pager Aggregator"
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
            <input type="number" value={freq} onChange={(e) => setFreq(e.target.value)} />
          </ControlField>
        </ControlRow>
      }
      footer={<RecordBar appId={"pager_aggregator" as any} format="jsonl" centerHz={parseFloat(freq) || undefined} />}
    >
      <DecoderTable
        headers={["Protocol", "RIC / Capcode", "Message"]}
        rows={pages}
        renderRow={(p) => [
          <span style={{ color: "var(--accent)" }}>{p.protocol}</span>,
          p.capcode,
          <span style={{ color: "var(--text-secondary)", wordBreak: "break-all" }}>{p.message}</span>,
        ]}
        emptyMessage="No pages yet — the aggregator decodes POCSAG, FLEX, and ERMES in parallel."
      />
    </AppShell>
  );
}
