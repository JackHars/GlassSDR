import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";
import { RecordBar } from "../../components/RecordBar";
import { AppShell, ControlField, ControlRow } from "../../components/AppShell";

interface PulseEventIpc { is_high: boolean; duration_us: number; }

export function SubGhzCaptureApp() {
  const [pulses, setPulses] = useState<PulseEventIpc[]>([]);
  const [freqHz, setFreqHz] = useState(433_920_000);
  const [running, setRunning] = useState(false);

  const handleStart = async () => {
    await startApp("sub_ghz_capture" as AppId, { center_hz: freqHz, lna_gain_db: 40, vga_gain_db: 20, amp_enabled: false });
    setRunning(true);
  };
  const handleStop = async () => { await stopApp(); setRunning(false); };

  useEffect(() => {
    const unlisten = listen<PulseEventIpc>("pulse_event", (e) =>
      setPulses((prev) => [e.payload, ...prev].slice(0, 1000))
    );
    return () => { unlisten.then((f) => f()); };
  }, []);

  const totalDuration = pulses.reduce((acc, p) => acc + p.duration_us, 0);

  return (
    <AppShell
      title="Sub-GHz Capture"
      status={running ? <><span style={{color: "#34C759"}}>●</span> Capturing · {pulses.length} pulses · {(totalDuration / 1000).toFixed(2)} ms</> : <><span style={{color: "#999"}}>○</span> Idle</>}
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
      footer={<RecordBar appId={"sub_ghz_capture" as any} format="jsonl" centerHz={freqHz} />}
    >
      <div className="app-shell__grow" style={{ overflow: "auto", borderRadius: 12, background: "rgba(255,255,255,0.55)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.7)", fontFamily: "var(--font-mono)", fontSize: 12, minHeight: 200 }}>
        {pulses.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--text-tertiary)" }}>
            No pulses yet — capturing OOK transitions for replay.
          </div>
        ) : (
          pulses.map((p, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "4px 12px", borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
              <span style={{ color: p.is_high ? "#34C759" : "var(--text-tertiary)", fontWeight: 600, width: 50 }}>
                {p.is_high ? "HIGH" : "LOW"}
              </span>
              <span style={{ width: 90, textAlign: "right", color: "var(--text-primary)" }}>{p.duration_us.toFixed(1)} µs</span>
              <div style={{
                flex: 1,
                height: 6,
                background: p.is_high ? "rgba(52,199,89,0.6)" : "rgba(0,0,0,0.2)",
                maxWidth: Math.min(420, p.duration_us * 0.2),
                borderRadius: 2,
              }} />
            </div>
          ))
        )}
      </div>
    </AppShell>
  );
}
