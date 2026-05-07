import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";
import { RecordBar } from "../../components/RecordBar";
import { AppShell, ControlField, ControlRow } from "../../components/AppShell";
import { DecoderTable } from "../../components/DecoderTable";

interface OokDecodeEvent { protocol: string; code_hex: string; }

export function OokDecodersApp() {
  const [decoded, setDecoded] = useState<OokDecodeEvent[]>([]);
  const [freqHz, setFreqHz] = useState(433_920_000);
  const [running, setRunning] = useState(false);

  const handleStart = async () => {
    await startApp("ook_decoders" as AppId, { center_hz: freqHz, lna_gain_db: 40, vga_gain_db: 20, amp_enabled: false });
    setRunning(true);
  };
  const handleStop = async () => { await stopApp(); setRunning(false); };

  useEffect(() => {
    const unlisten = listen<OokDecodeEvent>("ook_decode", (e) =>
      setDecoded((prev) => [e.payload, ...prev].slice(0, 200))
    );
    return () => { unlisten.then((f) => f()); };
  }, []);

  return (
    <AppShell
      title="OOK Decoders"
      status={running ? <><span style={{color: "#34C759"}}>●</span> Decoding · {decoded.length} frames</> : <><span style={{color: "#999"}}>○</span> Idle</>}
      controls={
        <ControlRow
          actions={
            <>
              <button className="glass-btn primary" onClick={handleStart} disabled={running}>Start</button>
              <button className="glass-btn" onClick={handleStop} disabled={!running}>Stop</button>
              <button className="glass-btn" onClick={() => setDecoded([])}>Clear</button>
            </>
          }
        >
          <ControlField label="Frequency (Hz)" size="lg">
            <input type="number" value={freqHz} onChange={(e) => setFreqHz(Number(e.target.value))} />
          </ControlField>
        </ControlRow>
      }
      footer={<RecordBar appId={"ook_decoders" as any} format="jsonl" centerHz={freqHz} />}
    >
      <DecoderTable
        headers={["Protocol", "Code (hex)"]}
        rows={decoded}
        renderRow={(d) => [<span style={{ color: "var(--accent)" }}>{d.protocol}</span>, d.code_hex]}
        emptyMessage="No frames decoded yet — common OOK protocols include PT2262, EV1527, Princeton, and others."
      />
    </AppShell>
  );
}
