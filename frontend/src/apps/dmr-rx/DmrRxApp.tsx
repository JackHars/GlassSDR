import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";
import { RecordBar } from "../../components/RecordBar";
import { AppShell, ControlField, ControlRow } from "../../components/AppShell";
import { DecoderTable } from "../../components/DecoderTable";

interface DigitalVoiceEvent { protocol: string; talkgroup: number; source_id: number; call_type: string; }
interface DmrRow extends DigitalVoiceEvent { slot: number; color_code: number; }

export function DmrRxApp() {
  const [freq, setFreq] = useState("439000000");
  const [rows, setRows] = useState<DmrRow[]>([]);
  const [running, setRunning] = useState(false);

  const handleStart = async () => {
    await startApp("dmr_rx" as AppId, { center_hz: parseFloat(freq), lna_gain_db: 32, vga_gain_db: 20, amp_enabled: false });
    setRunning(true);
  };
  const handleStop = async () => { await stopApp(); setRunning(false); };

  useEffect(() => {
    const unlisten = listen<DigitalVoiceEvent>("digital_voice", (e) => {
      if (e.payload.protocol === "DMR") {
        const row: DmrRow = { ...e.payload, slot: 1, color_code: 0 };
        setRows((prev) => [row, ...prev].slice(0, 200));
      }
    });
    return () => { unlisten.then((f) => f()); };
  }, []);

  return (
    <AppShell
      title="DMR Receiver"
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
      footer={<RecordBar appId={"dmr_rx" as any} format="jsonl" centerHz={parseFloat(freq) || undefined} />}
    >
      <DecoderTable
        headers={["Slot", "CC", "Talkgroup", "Source", "Type"]}
        rows={rows}
        renderRow={(r) => [r.slot, r.color_code, r.talkgroup, r.source_id, <span style={{ color: "var(--text-secondary)" }}>{r.call_type}</span>]}
        emptyMessage="No calls yet — only unencrypted DMR traffic is decoded."
      />
    </AppShell>
  );
}
