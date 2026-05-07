import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";
import { RecordBar } from "../../components/RecordBar";
import { AppShell, ControlField, ControlRow } from "../../components/AppShell";
import { DecoderTable } from "../../components/DecoderTable";

interface AcarsMessageEvent {
  reg: string;
  flight: string;
  label: string;
  text: string;
}

export function AcarsRxApp() {
  const [freq, setFreq] = useState("129125000");
  const [messages, setMessages] = useState<AcarsMessageEvent[]>([]);
  const [running, setRunning] = useState(false);

  const handleStart = async () => {
    await startApp("acars_rx" as AppId, { center_hz: parseFloat(freq), lna_gain_db: 32, vga_gain_db: 20, amp_enabled: false });
    setRunning(true);
  };
  const handleStop = async () => { await stopApp(); setRunning(false); };

  useEffect(() => {
    const unlisten = listen<AcarsMessageEvent>("acars_message", (e) =>
      setMessages((prev) => [e.payload, ...prev].slice(0, 200))
    );
    return () => { unlisten.then((f) => f()); };
  }, []);

  return (
    <AppShell
      title="ACARS Receiver"
      status={running ? <><span style={{color: "#34C759"}}>●</span> Listening · {messages.length} messages</> : <><span style={{color: "#999"}}>○</span> Idle</>}
      controls={
        <ControlRow
          actions={
            <>
              <button className="glass-btn primary" onClick={handleStart} disabled={running}>Start</button>
              <button className="glass-btn" onClick={handleStop} disabled={!running}>Stop</button>
              <button className="glass-btn" onClick={() => setMessages([])}>Clear</button>
            </>
          }
        >
          <ControlField label="Frequency (Hz)" size="lg">
            <input value={freq} onChange={(e) => setFreq(e.target.value)} />
          </ControlField>
        </ControlRow>
      }
      footer={<RecordBar appId={"acars_rx" as any} format="jsonl" centerHz={parseFloat(freq) || undefined} />}
    >
      <DecoderTable
        headers={["Reg", "Flight", "Label", "Text"]}
        rows={messages}
        renderRow={(m) => [m.reg, m.flight, m.label, <span style={{ color: "var(--text-secondary)", wordBreak: "break-all" }}>{m.text}</span>]}
        emptyMessage="No ACARS messages yet — press Start to listen."
      />
    </AppShell>
  );
}
