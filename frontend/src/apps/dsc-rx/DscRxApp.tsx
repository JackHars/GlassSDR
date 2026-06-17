import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";
import { RecordBar } from "../../components/RecordBar";
import { DecoderFeed } from "../../components/kit/DecoderFeed";
import type { DecoderColumn } from "../../components/kit/DecoderFeed";
import { AppScreen } from "../../components/kit/AppScreen";
import type { AppStatus } from "../../components/kit/AppScreen";
import "./DscRx.css";

interface DscMessageEvent { mmsi: number; category: string; }
type Msg = DscMessageEvent & { id: number };
let _id = 0;

const COLS: DecoderColumn<Msg>[] = [
  { key: "mmsi", label: "MMSI", width: "100px", mono: true },
  { key: "category", label: "Category", render: (m) => (
    <span className={`dsc-category-badge${m.category.toLowerCase().includes("distress") ? " distress" : ""}`}>{m.category}</span>
  )},
];

export function DscRxApp() {
  const [freqHz, setFreqHz] = useState(156_525_000);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const p = listen<DscMessageEvent>("dsc_message", (e) =>
      setMessages((prev) => [{ ...e.payload, id: ++_id }, ...prev].slice(0, 200))
    );
    return () => { p.then((f) => f()); };
  }, []);

  const handleStart = async () => {
    await startApp("dsc_rx" as AppId, { center_hz: freqHz, lna_gain_db: 32, vga_gain_db: 20, amp_enabled: false });
    setRunning(true);
  };
  const handleStop = async () => { await stopApp(); setRunning(false); };

  const appStatus: AppStatus = running ? (messages.length > 0 ? "live" : "acquiring") : "idle";

  return (
    <AppScreen
      appId="dsc_rx"
      title="DSC Receiver"
      subtitle="Ch 70 · 156.525 MHz"
      status={appStatus}
      statusText={running ? (messages.length > 0 ? `${messages.length} messages` : "Listening") : "Idle"}
      controls={
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "12px 16px", width: "100%" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label className="app-shell__field-label">Frequency (Hz)</label>
            <input type="number" value={freqHz} style={{ width: 130 }} onChange={(e) => setFreqHz(+e.target.value)} />
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignSelf: "flex-end" }}>
            <button className="glass-btn primary" onClick={handleStart} disabled={running}>Start</button>
            <button className="glass-btn" onClick={handleStop} disabled={!running}>Stop</button>
            <button className="glass-btn" onClick={() => setMessages([])}>Clear</button>
          </div>
        </div>
      }
      footer={<RecordBar appId={"dsc_rx" as Parameters<typeof RecordBar>[0]["appId"]} format="jsonl" centerHz={freqHz} />}
    >
      <DecoderFeed
        items={messages}
        columns={COLS}
        filterFn={(m, q) => String(m.mmsi).includes(q) || m.category.toLowerCase().includes(q)}
        emptyLabel="No DSC traffic — Ch 70 is the marine distress channel"
        emptyIcon="anchor"
      />
    </AppScreen>
  );
}
