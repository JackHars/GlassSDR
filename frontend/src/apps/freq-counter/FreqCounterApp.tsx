import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";
import { RecordBar } from "../../components/RecordBar";
import { AppShell, ControlField, ControlRow } from "../../components/AppShell";

interface FreqMeasureEvent { frequency_hz: number; precision_hz: number; }
type GateTime = 100 | 1000 | 10000;

function formatHz(hz: number): string {
  if (hz >= 1e9) return `${(hz / 1e9).toFixed(6)} GHz`;
  if (hz >= 1e6) return `${(hz / 1e6).toFixed(6)} MHz`;
  if (hz >= 1e3) return `${(hz / 1e3).toFixed(3)} kHz`;
  return `${hz.toFixed(1)} Hz`;
}

export function FreqCounterApp() {
  const [centerHz, setCenterHz] = useState(100_000_000);
  const [gateMs, setGateMs] = useState<GateTime>(1000);
  const [running, setRunning] = useState(false);
  const [measured, setMeasured] = useState<FreqMeasureEvent | null>(null);

  useEffect(() => {
    const ul = listen<FreqMeasureEvent>("freq_measure", (e) => setMeasured(e.payload));
    return () => { ul.then((f) => f()); };
  }, []);

  const start = async () => {
    await startApp("freq_counter" as AppId, { center_hz: centerHz, gate_ms: gateMs });
    setRunning(true);
  };
  const stop = async () => { await stopApp(); setRunning(false); };

  return (
    <AppShell
      title="Frequency Counter"
      status={running ? <><span style={{color: "#34C759"}}>●</span> Measuring · gate {gateMs} ms</> : <><span style={{color: "#999"}}>○</span> Idle</>}
      controls={
        <ControlRow
          actions={
            <>
              <button className="glass-btn primary" onClick={start} disabled={running}>Start</button>
              <button className="glass-btn" onClick={stop} disabled={!running}>Stop</button>
            </>
          }
        >
          <ControlField label="Center Frequency (Hz)" size="lg">
            <input type="number" value={centerHz} onChange={(e) => setCenterHz(Number(e.target.value))} />
          </ControlField>
          <ControlField label="Gate Time" size="md">
            <select value={gateMs} onChange={(e) => setGateMs(Number(e.target.value) as GateTime)}>
              <option value={100}>100 ms</option>
              <option value={1000}>1 s</option>
              <option value={10000}>10 s</option>
            </select>
          </ControlField>
        </ControlRow>
      }
      footer={<RecordBar appId={"freq_counter" as any} format="jsonl" centerHz={centerHz} />}
    >
      <div className="app-shell__grow" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 650, textTransform: "uppercase", letterSpacing: 0.6, color: "var(--text-secondary)" }}>
          Measured Frequency
        </div>
        <div style={{
          fontSize: 64, fontFamily: "var(--font-mono)", letterSpacing: 2,
          color: measured ? "var(--accent)" : "var(--text-tertiary)",
          textAlign: "center",
        }}>
          {measured ? formatHz(measured.frequency_hz) : "—"}
        </div>
        {measured && (
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            Precision ±{measured.precision_hz.toFixed(1)} Hz
          </div>
        )}
      </div>
    </AppShell>
  );
}
