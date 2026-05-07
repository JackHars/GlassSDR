import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";
import { RecordBar } from "../../components/RecordBar";
import { AppShell, ControlField, ControlRow } from "../../components/AppShell";

interface AfskBitEvent {
  hex_dump: string;
  decoded_ascii: string;
}

export function AfskRxApp() {
  const [freq, setFreq] = useState("144800000");
  const [markHz, setMarkHz] = useState("1200");
  const [spaceHz, setSpaceHz] = useState("2200");
  const [baud, setBaud] = useState("1200");
  const [frames, setFrames] = useState<AfskBitEvent[]>([]);
  const [running, setRunning] = useState(false);

  const handleStart = async () => {
    await startApp("afsk_rx" as AppId, {
      center_hz: parseFloat(freq),
      mark_hz: parseFloat(markHz),
      space_hz: parseFloat(spaceHz),
      baud_rate: parseFloat(baud),
      lna_gain_db: 32, vga_gain_db: 20, amp_enabled: false,
    });
    setRunning(true);
  };
  const handleStop = async () => { await stopApp(); setRunning(false); };

  useEffect(() => {
    const unlisten = listen<AfskBitEvent>("afsk_bits", (e) =>
      setFrames((prev) => [e.payload, ...prev].slice(0, 100))
    );
    return () => { unlisten.then((f) => f()); };
  }, []);

  return (
    <AppShell
      title="AFSK Receiver"
      status={running ? <><span style={{color: "#34C759"}}>●</span> Listening · {frames.length} frames</> : <><span style={{color: "#999"}}>○</span> Idle</>}
      controls={
        <ControlRow
          actions={
            <>
              <button className="glass-btn primary" onClick={handleStart} disabled={running}>Start</button>
              <button className="glass-btn" onClick={handleStop} disabled={!running}>Stop</button>
              <button className="glass-btn" onClick={() => setFrames([])}>Clear</button>
            </>
          }
        >
          <ControlField label="Frequency (Hz)" size="lg">
            <input value={freq} onChange={(e) => setFreq(e.target.value)} />
          </ControlField>
          <ControlField label="Mark (Hz)" size="sm">
            <input value={markHz} onChange={(e) => setMarkHz(e.target.value)} />
          </ControlField>
          <ControlField label="Space (Hz)" size="sm">
            <input value={spaceHz} onChange={(e) => setSpaceHz(e.target.value)} />
          </ControlField>
          <ControlField label="Baud" size="sm">
            <input value={baud} onChange={(e) => setBaud(e.target.value)} />
          </ControlField>
        </ControlRow>
      }
      footer={<RecordBar appId={"afsk_rx" as any} format="jsonl" centerHz={parseFloat(freq) || undefined} />}
    >
      <div className="app-shell__grow" style={{ overflow: "auto", borderRadius: 12, background: "rgba(255,255,255,0.55)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.7)", padding: 12, minHeight: 200 }}>
        {frames.length === 0 && (
          <div style={{ padding: 32, textAlign: "center", color: "var(--text-tertiary)" }}>
            No frames yet — press Start to listen.
          </div>
        )}
        {frames.map((f, i) => (
          <div key={i} style={{ marginBottom: 8, background: "rgba(0,0,0,0.04)", padding: 10, borderRadius: 8 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent)", wordBreak: "break-all" }}>{f.hex_dump}</div>
            {f.decoded_ascii && (
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-secondary)", marginTop: 4, wordBreak: "break-all" }}>{f.decoded_ascii}</div>
            )}
          </div>
        ))}
      </div>
    </AppShell>
  );
}
