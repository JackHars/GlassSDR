import { useState, useEffect } from "react";
import { startApp, stopApp } from "../../ipc/commands";
import { listen } from "@tauri-apps/api/event";
import { RecordBar } from "../../components/RecordBar";
import { AppShell, ControlField, ControlRow } from "../../components/AppShell";

interface RdsData { pi: number; ps: string; rt: string; pty: number; }

export function RdsRxApp() {
  const [freq, setFreq] = useState("98100000");
  const [lna, setLna] = useState(24);
  const [vga, setVga] = useState(20);
  const [rds, setRds] = useState<RdsData | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const p = listen<RdsData>("rds_data", (e) => setRds(e.payload));
    return () => { p.then((fn) => fn()); };
  }, []);

  const handleStart = async () => {
    await startApp("rds_rx" as any, {
      center_hz: parseFloat(freq), lna_gain_db: lna, vga_gain_db: vga, amp_enabled: false, stereo: true,
    });
    setRunning(true);
  };
  const handleStop = async () => { await stopApp(); setRunning(false); };

  return (
    <AppShell
      title="RDS Decoder"
      status={
        running
          ? rds
            ? <><span style={{color: "#34C759"}}>●</span> {rds.ps || "tuned"} · PI {rds.pi.toString(16).toUpperCase()}</>
            : <><span style={{color: "#34C759"}}>●</span> Listening</>
          : <><span style={{color: "#999"}}>○</span> Idle · 88–108 MHz FM broadcast</>
      }
      controls={
        <ControlRow
          actions={
            <>
              <button className="glass-btn primary" onClick={handleStart} disabled={running}>Start</button>
              <button className="glass-btn" onClick={handleStop} disabled={!running}>Stop</button>
            </>
          }
        >
          <ControlField label="Frequency (Hz)" size="lg">
            <input value={freq} onChange={(e) => setFreq(e.target.value)} />
          </ControlField>
          <ControlField label={`LNA ${lna} dB`} size="md">
            <input type="range" min={0} max={40} step={8} value={lna} onChange={(e) => setLna(+e.target.value)} />
          </ControlField>
          <ControlField label={`VGA ${vga} dB`} size="md">
            <input type="range" min={0} max={62} step={2} value={vga} onChange={(e) => setVga(+e.target.value)} />
          </ControlField>
        </ControlRow>
      }
      footer={<RecordBar appId={"rds_rx" as any} format="jsonl" centerHz={parseFloat(freq) || undefined} />}
    >
      <div className="app-shell__grow" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 650, textTransform: "uppercase", letterSpacing: 0.6, color: "var(--text-secondary)" }}>Station Name</div>
          <div style={{ fontSize: 56, fontFamily: "var(--font-mono)", color: rds?.ps ? "var(--accent)" : "var(--text-tertiary)" }}>
            {rds?.ps || "—"}
          </div>
        </div>
        <div style={{ width: "100%", maxWidth: 600, padding: 16, background: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.7)", borderRadius: 12, backdropFilter: "blur(16px)", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, fontWeight: 650, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--text-secondary)" }}>Radio Text</span>
            {rds && (
              <span style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                PI {rds.pi.toString(16).toUpperCase()} · PTY {rds.pty}
              </span>
            )}
          </div>
          <div style={{ fontSize: 16, color: "var(--text-primary)", minHeight: 24 }}>
            {rds?.rt || <span style={{ color: "var(--text-tertiary)" }}>—</span>}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
