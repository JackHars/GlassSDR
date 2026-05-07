import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";
import { RecordBar } from "../../components/RecordBar";
import { AppShell, ControlField, ControlRow } from "../../components/AppShell";

interface PulseEventIpc { is_high: boolean; duration_us: number; }

export function OokAnalyzerApp() {
  const [pulses, setPulses] = useState<PulseEventIpc[]>([]);
  const [freqHz, setFreqHz] = useState(433_920_000);
  const [running, setRunning] = useState(false);

  const handleStart = async () => {
    await startApp("ook_analyzer" as AppId, { center_hz: freqHz, lna_gain_db: 40, vga_gain_db: 20, amp_enabled: false });
    setRunning(true);
  };
  const handleStop = async () => { await stopApp(); setRunning(false); };

  useEffect(() => {
    const unlisten = listen<PulseEventIpc>("pulse_event", (e) =>
      setPulses((prev) => [e.payload, ...prev].slice(0, 500))
    );
    return () => { unlisten.then((f) => f()); };
  }, []);

  return (
    <AppShell
      title="OOK Analyzer"
      status={running ? <><span style={{color: "#34C759"}}>●</span> Capturing pulses · {pulses.length}</> : <><span style={{color: "#999"}}>○</span> Idle</>}
      controls={
        <ControlRow
          actions={
            <>
              <button className="glass-btn primary" onClick={handleStart} disabled={running}>Start</button>
              <button className="glass-btn" onClick={handleStop} disabled={!running}>Stop</button>
              <button className="glass-btn" onClick={() => setPulses([])}>Clear</button>
            </>
          }
        >
          <ControlField label="Frequency (Hz)" size="lg">
            <input type="number" value={freqHz} onChange={(e) => setFreqHz(Number(e.target.value))} />
          </ControlField>
        </ControlRow>
      }
      footer={<RecordBar appId={"ook_analyzer" as any} format="jsonl" centerHz={freqHz} />}
    >
      <div className="app-shell__grow" style={{ overflow: "auto", borderRadius: 12, background: "rgba(255,255,255,0.55)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.7)", fontFamily: "var(--font-mono)", fontSize: 12, minHeight: 200 }}>
        {pulses.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--text-tertiary)" }}>
            No pulses yet — listening for OOK transitions.
          </div>
        ) : (
          pulses.map((p, i) => (
            <div key={i} style={{ padding: "4px 12px", borderBottom: "1px solid rgba(0,0,0,0.04)", background: p.is_high ? "rgba(52,199,89,0.06)" : "transparent" }}>
              <span style={{ color: p.is_high ? "#34C759" : "var(--text-tertiary)", fontWeight: 600, marginRight: 12, display: "inline-block", width: 50 }}>
                {p.is_high ? "HIGH" : "LOW"}
              </span>
              {p.duration_us.toFixed(1)} µs
            </div>
          ))
        )}
      </div>
    </AppShell>
  );
}
