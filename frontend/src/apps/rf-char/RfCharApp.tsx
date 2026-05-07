import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";
import { RecordBar } from "../../components/RecordBar";
import { AppShell, ControlField, ControlRow } from "../../components/AppShell";

interface TxStatus {
  kind: "idle" | "armed" | "transmitting" | "complete" | "error";
  progress_pct?: number;
  message?: string;
}

export function RfCharApp() {
  const [startHz, setStartHz] = useState(88_000_000);
  const [stopHz, setStopHz] = useState(108_000_000);
  const [stepHz, setStepHz] = useState(1_000_000);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<TxStatus | null>(null);

  useEffect(() => {
    const ul = listen<TxStatus>("tx_status", (e) => setStatus(e.payload));
    return () => { ul.then((f) => f()); };
  }, []);

  const start = async () => {
    await startApp("rf_characterize" as AppId, { start_hz: startHz, stop_hz: stopHz, step_hz: stepHz });
    setRunning(true);
  };
  const stop = async () => { await stopApp(); setRunning(false); };

  return (
    <AppShell
      title="RF Characterization"
      status={
        running ? <><span style={{color: "#34C759"}}>●</span> Sweeping {(startHz / 1e6).toFixed(1)}–{(stopHz / 1e6).toFixed(1)} MHz</>
        : <><span style={{color: "#999"}}>○</span> Idle</>
      }
      controls={
        <ControlRow
          actions={
            <>
              <button className="glass-btn primary" onClick={start} disabled={running}>Start Sweep</button>
              <button className="glass-btn" onClick={stop} disabled={!running}>Stop</button>
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
      footer={<RecordBar appId={"rf_characterize" as any} format="iq" />}
    >
      <div className="app-shell__grow" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ padding: "12px 16px", background: "rgba(255,149,0,0.08)", border: "1px solid rgba(255,149,0,0.4)", borderRadius: 10, color: "#A86200", fontSize: 13 }}>
          <strong>INDOOR TEST ONLY</strong> — operate only inside a shielded enclosure.
        </div>
        <div style={{ flex: 1, padding: 16, background: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.7)", borderRadius: 12, backdropFilter: "blur(16px)", display: "flex", flexDirection: "column", gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 650, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--text-secondary)" }}>Sweep Configuration</h3>
          <div style={{ fontFamily: "var(--font-mono)", color: "var(--text-primary)", fontSize: 13, lineHeight: 1.7 }}>
            Range: {(startHz / 1e6).toFixed(3)} – {(stopHz / 1e6).toFixed(3)} MHz<br />
            Step: {(stepHz / 1e3).toFixed(1)} kHz · {Math.ceil((stopHz - startHz) / stepHz)} points
          </div>
        </div>
        {status && (
          <div style={{ padding: 12, background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 8, fontFamily: "var(--font-mono)", fontSize: 12 }}>
            Status: {status.kind}{status.progress_pct !== undefined ? ` · ${status.progress_pct}%` : ""}{status.message ? ` · ${status.message}` : ""}
          </div>
        )}
      </div>
    </AppShell>
  );
}
