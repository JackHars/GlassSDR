import { useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";
import type { PocsagPageEvent } from "../../ipc/types/PocsagPageEvent";
import { RecordBar } from "../../components/RecordBar";
import { DecoderFeed } from "../../components/kit/DecoderFeed";
import type { DecoderColumn } from "../../components/kit/DecoderFeed";
import { FieldInspector } from "../../components/kit/DecoderFeed";
import { AppScreen } from "../../components/kit/AppScreen";
import type { AppStatus } from "../../components/kit/AppScreen";
import "./PagerAgg.css";

interface AggPage { protocol: string; capcode: number; message: string; id: number; }
interface FlexPageEvent { capcode: number; message: string; cycle: number; frame: number; }

const COLUMNS: DecoderColumn<AggPage>[] = [
  {
    key: "protocol", label: "Proto", width: "80px",
    render: (p) => <span className={`pagg-proto-badge pagg-proto-badge--${p.protocol}`}>{p.protocol}</span>,
  },
  { key: "capcode", label: "Capcode", width: "90px", mono: true, render: (p) => p.capcode.toString().padStart(7, "0") },
  { key: "message", label: "Message" },
];

let _id = 0;

export function PagerAggApp() {
  const [freqHz, setFreqHz] = useState(439_987_500);
  const [pages, setPages] = useState<AggPage[]>([]);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const uPocsag = listen<PocsagPageEvent>("pocsag_page", (e) =>
      setPages((prev) => [{ protocol: "POCSAG", capcode: e.payload.ric, message: e.payload.message, id: ++_id }, ...prev].slice(0, 400))
    );
    const uFlex = listen<FlexPageEvent>("flex_page", (e) =>
      setPages((prev) => [{ protocol: "FLEX", capcode: e.payload.capcode, message: e.payload.message, id: ++_id }, ...prev].slice(0, 400))
    );
    return () => { uPocsag.then((f) => f()); uFlex.then((f) => f()); };
  }, []);

  const handleStart = async () => {
    await startApp("pager_aggregator" as AppId, { center_hz: freqHz, lna_gain_db: 32, vga_gain_db: 20, amp_enabled: false });
    setRunning(true);
  };
  const handleStop = async () => { await stopApp(); setRunning(false); };

  const count = pages.length;
  const pocsagCount = useMemo(() => pages.filter((p) => p.protocol === "POCSAG").length, [pages]);
  const flexCount = useMemo(() => pages.filter((p) => p.protocol === "FLEX").length, [pages]);
  const appStatus: AppStatus = running ? (count > 0 ? "live" : "acquiring") : "idle";

  return (
    <AppScreen
      appId="pager_aggregator"
      title="Pager Aggregator"
      subtitle={`${(freqHz / 1e6).toFixed(4)} MHz`}
      status={appStatus}
      statusText={running ? (count > 0 ? `${count} pages` : "Listening") : "Idle"}
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
      footer={<RecordBar appId={"pager_aggregator" as Parameters<typeof RecordBar>[0]["appId"]} format="jsonl" centerHz={freqHz} />}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: "1 1 auto", minHeight: 0 }}>
        <div className="pagg-stats">
          <div className="pagg-stat"><span className="pagg-stat-label">Total</span><span className="pagg-stat-value">{count}</span></div>
          <div className="pagg-stat"><span className="pagg-stat-label">POCSAG</span><span className="pagg-stat-value">{pocsagCount}</span></div>
          <div className="pagg-stat"><span className="pagg-stat-label">FLEX</span><span className="pagg-stat-value">{flexCount}</span></div>
        </div>
        <DecoderFeed
          items={pages}
          columns={COLUMNS}
          filterFn={(p, q) => p.capcode.toString().includes(q) || p.message.toLowerCase().includes(q) || p.protocol.toLowerCase().includes(q)}
          emptyLabel="Aggregating POCSAG + FLEX pages…"
          emptyIcon="📟"
          renderInspector={(p) => (
            <FieldInspector
              title={`${p.protocol} · Capcode ${p.capcode.toString().padStart(7, "0")}`}
              fields={[
                { label: "Protocol", value: p.protocol, mono: true, accent: true },
                { label: "Capcode", value: p.capcode.toString().padStart(7, "0"), mono: true },
                { label: "Message", value: p.message || "(no text)" },
              ]}
            />
          )}
        />
      </div>
    </AppScreen>
  );
}
