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
import "./PocsagRx.css";

type Page = PocsagPageEvent & { id: number };

const FN_NAMES: Record<number, string> = { 0: "TONE", 1: "NUM", 2: "ALPHA", 3: "EXEC" };

const COLUMNS: DecoderColumn<Page>[] = [
  {
    key: "ric",
    label: "Capcode",
    width: "90px",
    mono: true,
    render: (p) => p.ric.toString().padStart(7, "0"),
  },
  {
    key: "function",
    label: "Type",
    width: "60px",
    render: (p) => (
      <span className={`pocsag-fn pocsag-fn--${p.function}`}>
        {FN_NAMES[p.function] ?? `FN${p.function}`}
      </span>
    ),
  },
  { key: "message", label: "Message" },
];

function filterPage(p: Page, q: string): boolean {
  return String(p.ric).includes(q) || p.message.toLowerCase().includes(q);
}

// Common POCSAG frequencies
const FREQS = [
  { label: "152.0", hz: 152_000_000 },
  { label: "440.0", hz: 440_000_000 },
  { label: "461.0", hz: 461_000_000 },
];

let _id = 0;

export function PocsagRxApp() {
  const [freqHz, setFreqHz] = useState(439_987_500);
  const [pages, setPages] = useState<Page[]>([]);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const p = listen<PocsagPageEvent>("pocsag_page", (e) =>
      setPages((prev) => [{ ...e.payload, id: ++_id }, ...prev].slice(0, 300))
    );
    return () => { p.then((f) => f()); };
  }, []);

  const handleStart = async () => {
    await startApp("pocsag_rx" as AppId, { center_hz: freqHz, lna_gain_db: 32, vga_gain_db: 20, amp_enabled: false });
    setRunning(true);
  };
  const handleStop = async () => { await stopApp(); setRunning(false); };

  const count = pages.length;
  const alphaCount = useMemo(() => pages.filter((p) => p.function === 2).length, [pages]);
  const appStatus: AppStatus = running ? (count > 0 ? "live" : "acquiring") : "idle";

  return (
    <AppScreen
      appId="pocsag_rx"
      title="POCSAG Receiver"
      subtitle={`${(freqHz / 1e6).toFixed(4)} MHz`}
      status={appStatus}
      statusText={running ? (count > 0 ? `${count} pages` : "Listening") : "Idle"}
      controls={
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "12px 16px", width: "100%" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label className="app-shell__field-label">Frequency (Hz)</label>
            <input type="number" value={freqHz} style={{ width: 140 }} onChange={(e) => setFreqHz(+e.target.value)} />
            <div style={{ display: "flex", gap: 5 }}>
              {FREQS.map((f) => (
                <button key={f.hz} className="glass-btn"
                  style={{ padding: "3px 9px", fontSize: 11, fontFamily: "var(--font-mono)" }}
                  onClick={() => setFreqHz(f.hz)}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignSelf: "flex-end" }}>
            <button className="glass-btn primary" onClick={handleStart} disabled={running}>Start</button>
            <button className="glass-btn" onClick={handleStop} disabled={!running}>Stop</button>
            <button className="glass-btn" onClick={() => setPages([])}>Clear</button>
          </div>
        </div>
      }
      footer={
        <RecordBar appId={"pocsag_rx" as Parameters<typeof RecordBar>[0]["appId"]} format="jsonl" centerHz={freqHz} />
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: "1 1 auto", minHeight: 0 }}>
        {/* Stats strip */}
        <div className="pocsag-stats">
          <div className="pocsag-stat">
            <span className="pocsag-stat-label">Pages</span>
            <span className="pocsag-stat-value">{count}</span>
          </div>
          <div className="pocsag-stat">
            <span className="pocsag-stat-label">Alpha</span>
            <span className="pocsag-stat-value">{alphaCount}</span>
          </div>
        </div>

        {/* Perforated-paper feed */}
        <div className="pocsag-feed-wrap">
          <div className="pocsag-inner-feed">
            <DecoderFeed
              items={pages}
              columns={COLUMNS}
              filterFn={filterPage}
              emptyLabel="Waiting for pager traffic…"
              emptyIcon="pager"
              renderInspector={(p) => (
                <FieldInspector
                  title={`Capcode ${p.ric.toString().padStart(7, "0")}`}
                  fields={[
                    { label: "Capcode (RIC)", value: p.ric.toString().padStart(7, "0"), mono: true, accent: true },
                    { label: "Function", value: `${p.function} · ${FN_NAMES[p.function] ?? "?"}`, mono: true },
                    { label: "Message", value: p.message || "(no text)", mono: false },
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
