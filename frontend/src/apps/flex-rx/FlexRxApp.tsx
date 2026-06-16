import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";
import { RecordBar } from "../../components/RecordBar";
import { DecoderFeed } from "../../components/kit/DecoderFeed";
import type { DecoderColumn } from "../../components/kit/DecoderFeed";
import { FieldInspector } from "../../components/kit/DecoderFeed";
import { AppScreen } from "../../components/kit/AppScreen";
import type { AppStatus } from "../../components/kit/AppScreen";
import "./FlexRx.css";

interface FlexPageEvent { capcode: number; message: string; cycle: number; frame: number; }
type Page = FlexPageEvent & { id: number };

const COLUMNS: DecoderColumn<Page>[] = [
  { key: "capcode", label: "Capcode", width: "90px", mono: true, render: (p) => p.capcode.toString().padStart(9, "0") },
  { key: "cycle", label: "Cyc", width: "40px", mono: true },
  { key: "frame", label: "Frm", width: "40px", mono: true },
  { key: "message", label: "Message" },
];

let _id = 0;

export function FlexRxApp() {
  const [freqHz, setFreqHz] = useState(931_762_500);
  const [pages, setPages] = useState<Page[]>([]);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const p = listen<FlexPageEvent>("flex_page", (e) =>
      setPages((prev) => [{ ...e.payload, id: ++_id }, ...prev].slice(0, 300))
    );
    return () => { p.then((f) => f()); };
  }, []);

  const handleStart = async () => {
    await startApp("flex_rx" as AppId, { center_hz: freqHz, lna_gain_db: 32, vga_gain_db: 20, amp_enabled: false });
    setRunning(true);
  };
  const handleStop = async () => { await stopApp(); setRunning(false); };

  const appStatus: AppStatus = running ? (pages.length > 0 ? "live" : "acquiring") : "idle";

  return (
    <AppScreen
      appId="flex_rx"
      title="FLEX Pager"
      subtitle={`${(freqHz / 1e6).toFixed(4)} MHz`}
      status={appStatus}
      statusText={running ? (pages.length > 0 ? `${pages.length} pages` : "Listening") : "Idle"}
      controls={
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "12px 16px", width: "100%" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label className="app-shell__field-label">Frequency (Hz)</label>
            <input type="number" value={freqHz} style={{ width: 140 }} onChange={(e) => setFreqHz(+e.target.value)} />
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignSelf: "flex-end" }}>
            <button className="glass-btn primary" onClick={handleStart} disabled={running}>Start</button>
            <button className="glass-btn" onClick={handleStop} disabled={!running}>Stop</button>
            <button className="glass-btn" onClick={() => setPages([])}>Clear</button>
          </div>
        </div>
      }
      footer={<RecordBar appId={"flex_rx" as Parameters<typeof RecordBar>[0]["appId"]} format="jsonl" centerHz={freqHz} />}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: "1 1 auto", minHeight: 0 }}>
        <div className="flex-stats">
          <div className="flex-stat">
            <span className="flex-stat-label">Pages</span>
            <span className="flex-stat-value">{pages.length}</span>
          </div>
          <div className="flex-stat">
            <span className="flex-stat-label">Protocol</span>
            <span className="flex-stat-value">FLEX</span>
          </div>
        </div>
        <div className="flex-feed-wrap">
          <div className="flex-inner-feed">
            <DecoderFeed
              items={pages}
              columns={COLUMNS}
              filterFn={(p, q) => p.capcode.toString().includes(q) || p.message.toLowerCase().includes(q)}
              emptyLabel="Waiting for FLEX pages…"
              emptyIcon="📟"
              renderInspector={(p) => (
                <FieldInspector
                  title={`Capcode ${p.capcode.toString().padStart(9, "0")}`}
                  fields={[
                    { label: "Capcode", value: p.capcode.toString().padStart(9, "0"), mono: true, accent: true },
                    { label: "Cycle", value: p.cycle, mono: true },
                    { label: "Frame", value: p.frame, mono: true },
                    { label: "Message", value: p.message || "(no text)" },
                  ]}
                />
              )}
            />
          </div>
        </div>
      </div>
    </AppScreen>
  );
}
