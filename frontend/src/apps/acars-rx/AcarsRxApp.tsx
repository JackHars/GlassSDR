import { useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";
import type { AcarsMessageEvent } from "../../ipc/types/AcarsMessageEvent";
import { RecordBar } from "../../components/RecordBar";
import { DecoderFeed } from "../../components/kit/DecoderFeed";
import type { DecoderColumn } from "../../components/kit/DecoderFeed";
import { FieldInspector } from "../../components/kit/DecoderFeed";
import { AppScreen } from "../../components/kit/AppScreen";
import type { AppStatus } from "../../components/kit/AppScreen";
import "./AcarsRx.css";

type Msg = AcarsMessageEvent & { id: number };

const COLUMNS: DecoderColumn<Msg>[] = [
  { key: "reg", label: "Reg", width: "80px", mono: true },
  { key: "flight", label: "Flight", width: "80px", mono: true },
  { key: "label", label: "Label", width: "50px", mono: true },
  { key: "text", label: "Text" },
];

function filterMsg(m: Msg, q: string): boolean {
  return m.reg.toLowerCase().includes(q) ||
    m.flight.toLowerCase().includes(q) ||
    m.label.toLowerCase().includes(q) ||
    m.text.toLowerCase().includes(q);
}

let _id = 0;

// Common ACARS frequencies (MHz)
const FREQS = [
  { label: "129.125", hz: 129_125_000 },
  { label: "130.025", hz: 130_025_000 },
  { label: "130.450", hz: 130_450_000 },
  { label: "131.550", hz: 131_550_000 },
];

export function AcarsRxApp() {
  const [freqHz, setFreqHz] = useState(129_125_000);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const p = listen<AcarsMessageEvent>("acars_message", (e) =>
      setMessages((prev) => [{ ...e.payload, id: ++_id }, ...prev].slice(0, 300))
    );
    return () => { p.then((f) => f()); };
  }, []);

  const handleStart = async () => {
    await startApp("acars_rx" as AppId, { center_hz: freqHz, lna_gain_db: 32, vga_gain_db: 20, amp_enabled: false });
    setRunning(true);
  };
  const handleStop = async () => { await stopApp(); setRunning(false); };

  // Unique aircraft registrations seen
  const uniqueRegs = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const m of messages) {
      if (m.reg && !seen.has(m.reg)) { seen.add(m.reg); result.push(m.reg); }
    }
    return result.slice(0, 20); // cap display to 20
  }, [messages]);

  const count = messages.length;
  const appStatus: AppStatus = running ? (count > 0 ? "live" : "acquiring") : "idle";

  return (
    <AppScreen
      appId="acars_rx"
      title="ACARS Receiver"
      subtitle={`${(freqHz / 1e6).toFixed(3)} MHz`}
      status={appStatus}
      statusText={running ? (count > 0 ? `${count} messages` : "Listening") : "Idle"}
      controls={
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "12px 16px", width: "100%" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label className="app-shell__field-label">Frequency</label>
            <input
              type="number"
              value={freqHz}
              style={{ width: 130 }}
              onChange={(e) => setFreqHz(+e.target.value)}
            />
            <div style={{ display: "flex", gap: 5 }}>
              {FREQS.map((f) => (
                <button
                  key={f.hz}
                  className="glass-btn"
                  style={{ padding: "3px 9px", fontSize: 11, fontFamily: "var(--font-mono)" }}
                  onClick={() => setFreqHz(f.hz)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignSelf: "flex-end" }}>
            <button className="glass-btn primary" onClick={handleStart} disabled={running}>Start</button>
            <button className="glass-btn" onClick={handleStop} disabled={!running}>Stop</button>
            <button className="glass-btn" onClick={() => setMessages([])}>Clear</button>
          </div>
        </div>
      }
      footer={
        <RecordBar appId={"acars_rx" as Parameters<typeof RecordBar>[0]["appId"]} format="jsonl" centerHz={freqHz} />
      }
    >
      <div className="acars-layout">
        {/* Aircraft grid — unique registrations seen */}
        <div className="acars-aircraft-grid">
          {uniqueRegs.length === 0
            ? <span className="acars-aircraft-grid__empty">Aircraft will appear here as messages arrive</span>
            : uniqueRegs.map((reg) => (
              <span key={reg} className="acars-aircraft-chip">✈ {reg}</span>
            ))
          }
        </div>

        {/* Message feed */}
        <DecoderFeed
          items={messages}
          columns={COLUMNS}
          filterFn={filterMsg}
          emptyLabel="No ACARS messages yet"
          emptyIcon="✈"
          renderInspector={(m) => (
            <FieldInspector
              title={`${m.reg} · Flight ${m.flight}`}
              fields={[
                { label: "Registration", value: m.reg, mono: true, accent: true },
                { label: "Flight", value: m.flight, mono: true },
                { label: "Label", value: m.label, mono: true },
                { label: "Text", value: m.text, mono: true },
              ]}
            />
          )}
        />
      </div>
    </AppScreen>
  );
}
