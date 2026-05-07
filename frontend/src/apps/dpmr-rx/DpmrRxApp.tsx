import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";
import { RecordBar } from "../../components/RecordBar";
import { AppShell, ControlField, ControlRow } from "../../components/AppShell";
import { DecoderTable } from "../../components/DecoderTable";

interface DigitalVoiceEvent { protocol: string; talkgroup: number; source_id: number; call_type: string; }

export function DpmrRxApp() {
  const [freq, setFreq] = useState("446000000");
  const [rows, setRows] = useState<DigitalVoiceEvent[]>([]);
  const [running, setRunning] = useState(false);

  const handleStart = async () => {
    await startApp("dpmr_rx" as AppId, { center_hz: parseFloat(freq), lna_gain_db: 32, vga_gain_db: 20, amp_enabled: false });
    setRunning(true);
  };
  const handleStop = async () => { await stopApp(); setRunning(false); };

  useEffect(() => {
    const unlisten = listen<DigitalVoiceEvent>("digital_voice", (e) => {
      if (e.payload.protocol === "dPMR") setRows((prev) => [e.payload, ...prev].slice(0, 200));
    });
    return () => { unlisten.then((f) => f()); };
  }, []);

  return (
    <AppShell
      title="dPMR Receiver"
      status={running ? <><span style={{color: "#34C759"}}>●</span> Listening · {rows.length} calls</> : <><span style={{color: "#999"}}>○</span> Idle</>}
      controls={
        <ControlRow
          actions={
            <>
              <button className="glass-btn primary" onClick={handleStart} disabled={running}>Start</button>
              <button className="glass-btn" onClick={handleStop} disabled={!running}>Stop</button>
              <button className="glass-btn" onClick={() => setRows([])}>Clear</button>
            </>
          }
        >
          <ControlField label="Frequency (Hz)" size="lg">
            <input type="number" value={freq} onChange={(e) => setFreq(e.target.value)} />
          </ControlField>
        </ControlRow>
      }
      footer={<RecordBar appId={"dpmr_rx" as any} format="jsonl" centerHz={parseFloat(freq) || undefined} />}
    >
      <DecoderTable
        headers={["Source ID", "Dest ID", "Type"]}
        rows={rows}
        renderRow={(r) => [r.source_id, r.talkgroup, <span style={{ color: "var(--text-secondary)" }}>{r.call_type}</span>]}
        emptyMessage="No calls yet — only unencrypted dPMR traffic is decoded."
      />
    </AppShell>
  );
}
