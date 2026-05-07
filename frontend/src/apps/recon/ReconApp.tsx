import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";
import { RecordBar } from "../../components/RecordBar";
import { AppShell, ControlField, ControlRow } from "../../components/AppShell";

interface ScanResultEvent { freq_hz: number; power_db: number; }

export function ReconApp() {
  const [signals, setSignals] = useState<ScanResultEvent[]>([]);
  const [startHz, setStartHz] = useState(88_000_000);
  const [stopHz, setStopHz] = useState(1_000_000_000);
  const [stepHz, setStepHz] = useState(100_000);
  const [running, setRunning] = useState(false);

  const handleStart = async () => {
    await startApp("recon" as AppId, {
      start_hz: startHz, stop_hz: stopHz, step_hz: stepHz,
      lna_gain_db: 32, vga_gain_db: 20, amp_enabled: false,
    });
    setRunning(true);
  };
  const handleStop = async () => { await stopApp(); setRunning(false); };

  useEffect(() => {
    const unlisten = listen<ScanResultEvent>("scan_result", (e) =>
      setSignals((prev) => [e.payload, ...prev].slice(0, 1000))
    );
    return () => { unlisten.then((f) => f()); };
  }, []);

  return (
    <AppShell
      title="Recon"
      status={running ? <><span style={{color: "#34C759"}}>●</span> Sweeping · {signals.length} signals</> : <><span style={{color: "#999"}}>○</span> Idle</>}
      controls={
        <ControlRow
          actions={
            <>
              <button className="glass-btn primary" onClick={handleStart} disabled={running}>Start</button>
              <button className="glass-btn" onClick={handleStop} disabled={!running}>Stop</button>
              <button className="glass-btn" onClick={() => setSignals([])}>Clear</button>
            </>
          }
        >
          <ControlField label="Start (Hz)" size="md">
            <input type="number" value={startHz} onChange={(e) => setStartHz(Number(e.target.value))} />
          </ControlField>
          <ControlField label="Stop (Hz)" size="md">
            <input type="number" value={stopHz} onChange={(e) => setStopHz(Number(e.target.value))} />
          </ControlField>
          <ControlField label="Step (Hz)" size="sm">
            <input type="number" value={stepHz} onChange={(e) => setStepHz(Number(e.target.value))} />
          </ControlField>
        </ControlRow>
      }
      footer={<RecordBar appId={"recon" as any} format="jsonl" />}
    >
      <div className="app-shell__grow" style={{ overflow: "auto", borderRadius: 12, background: "rgba(255,255,255,0.55)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.7)", minHeight: 200 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ position: "sticky", top: 0, background: "rgba(255,255,255,0.85)", textAlign: "left", backdropFilter: "blur(8px)" }}>
              <th style={{ padding: "8px 12px", fontSize: 11, fontWeight: 650, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--text-secondary)" }}>Frequency</th>
              <th style={{ padding: "8px 12px", fontSize: 11, fontWeight: 650, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--text-secondary)" }}>Power (dB)</th>
              <th style={{ padding: "8px 12px", fontSize: 11, fontWeight: 650, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--text-secondary)" }}>Level</th>
            </tr>
          </thead>
          <tbody>
            {signals.map((s, i) => (
              <tr key={i} style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                <td style={{ padding: "6px 12px", fontFamily: "var(--font-mono)" }}>{(s.freq_hz / 1e6).toFixed(4)} MHz</td>
                <td style={{ padding: "6px 12px", fontFamily: "var(--font-mono)" }}>{s.power_db.toFixed(1)}</td>
                <td style={{ padding: "6px 12px" }}>
                  <div style={{
                    height: 8,
                    width: `${Math.max(0, Math.min(100, (s.power_db + 100) * 1.0))}%`,
                    background: s.power_db > -60 ? "#34C759" : "rgba(0,0,0,0.3)",
                    borderRadius: 3,
                  }} />
                </td>
              </tr>
            ))}
            {signals.length === 0 && (
              <tr><td colSpan={3} style={{ padding: 32, textAlign: "center", color: "var(--text-tertiary)" }}>
                No signals detected — set a range and press Start.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
