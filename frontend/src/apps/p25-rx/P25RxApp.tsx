import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";
import { RecordBar } from "../../components/RecordBar";
import { AppShell, ControlField, ControlRow } from "../../components/AppShell";
import { DecoderTable } from "../../components/DecoderTable";

interface DigitalVoiceEvent { protocol: string; talkgroup: number; source_id: number; call_type: string; }
interface P25Row extends DigitalVoiceEvent { nac: number; duid: number; }

export function P25RxApp() {
  const [freq, setFreq] = useState("851000000");
  const [rows, setRows] = useState<P25Row[]>([]);
  const [running, setRunning] = useState(false);

  const handleStart = async () => {
    await startApp("p25_rx" as AppId, { center_hz: parseFloat(freq), lna_gain_db: 32, vga_gain_db: 20, amp_enabled: false });
    setRunning(true);
  };
  const handleStop = async () => { await stopApp(); setRunning(false); };

  useEffect(() => {
    const unlisten = listen<DigitalVoiceEvent>("digital_voice", (e) => {
      if (e.payload.protocol === "P25") {
        const row: P25Row = { ...e.payload, nac: 0, duid: 0 };
        setRows((prev) => [row, ...prev].slice(0, 200));
      }
    });
    return () => { unlisten.then((f) => f()); };
  }, []);

  return (
    <AppShell
      title="P25 Receiver"
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
      footer={<RecordBar appId={"p25_rx" as any} format="jsonl" centerHz={parseFloat(freq) || undefined} />}
    >
      <DecoderTable
        headers={["NAC", "Talkgroup", "Source", "DUID"]}
        rows={rows}
        renderRow={(r) => [
          `0x${r.nac.toString(16).toUpperCase().padStart(3, "0")}`,
          r.talkgroup, r.source_id, <span style={{ color: "var(--text-secondary)" }}>{r.duid}</span>,
        ]}
        emptyMessage="No calls yet — only unencrypted P25 Phase 1 (FDMA) traffic is decoded."
      />
    </AppShell>
  );
}
