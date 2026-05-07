import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";
import { RecordBar } from "../../components/RecordBar";
import { AppShell, ControlField, ControlRow } from "../../components/AppShell";

interface CtcssDetectEvent { tone_hz: number; power_db: number; }

const KNOWN_TONES = [
  67.0, 71.9, 74.4, 77.0, 79.7, 82.5, 85.4, 88.5, 91.5, 94.8,
  97.4, 100.0, 103.5, 107.2, 110.9, 114.8, 118.8, 123.0, 127.3, 131.8,
  136.5, 141.3, 146.2, 151.4, 156.7, 162.2, 167.9, 173.8, 179.9, 186.2,
  192.8, 203.5, 210.7, 218.1, 225.7, 233.6, 241.8, 250.3,
];

function nearestTone(hz: number): string {
  const closest = KNOWN_TONES.reduce((a, b) => Math.abs(b - hz) < Math.abs(a - hz) ? b : a);
  return Math.abs(closest - hz) < 1.0 ? `${closest.toFixed(1)} Hz` : `${hz.toFixed(1)} Hz (unknown)`;
}

export function CtcssDcsApp() {
  const [centerHz, setCenterHz] = useState(146_520_000);
  const [running, setRunning] = useState(false);
  const [detected, setDetected] = useState<CtcssDetectEvent | null>(null);

  useEffect(() => {
    const ul = listen<CtcssDetectEvent>("ctcss_detect", (e) => {
      if (e.payload.tone_hz > 0) setDetected(e.payload);
    });
    return () => { ul.then((f) => f()); };
  }, []);

  const start = async () => {
    setDetected(null);
    await startApp("ctcss_dcs" as AppId, { center_hz: centerHz });
    setRunning(true);
  };
  const stop = async () => { await stopApp(); setRunning(false); };

  const hasSignal = detected && detected.tone_hz > 0;

  return (
    <AppShell
      title="CTCSS / DCS Decoder"
      status={running ? <><span style={{color: "#34C759"}}>●</span> Listening · {hasSignal ? `tone ${detected!.tone_hz.toFixed(1)} Hz` : "no tone"}</> : <><span style={{color: "#999"}}>○</span> Idle</>}
      controls={
        <ControlRow
          actions={
            <>
              <button className="glass-btn primary" onClick={start} disabled={running}>Start</button>
              <button className="glass-btn" onClick={stop} disabled={!running}>Stop</button>
            </>
          }
        >
          <ControlField label="Frequency (Hz)" size="lg">
            <input type="number" value={centerHz} onChange={(e) => setCenterHz(Number(e.target.value))} />
          </ControlField>
        </ControlRow>
      }
      footer={<RecordBar appId={"ctcss_dcs" as any} format="jsonl" centerHz={centerHz} />}
    >
      <div className="app-shell__grow" style={{ display: "flex", flexDirection: "column", gap: 16, minHeight: 0 }}>
        <div style={{
          padding: 24, background: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.7)", borderRadius: 12, backdropFilter: "blur(16px)",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
        }}>
          <div style={{ fontSize: 11, fontWeight: 650, textTransform: "uppercase", letterSpacing: 0.6, color: "var(--text-secondary)" }}>
            Detected Tone
          </div>
          <div style={{ fontSize: 56, fontFamily: "var(--font-mono)", color: hasSignal ? "var(--accent)" : "var(--text-tertiary)" }}>
            {hasSignal ? nearestTone(detected!.tone_hz) : "—"}
          </div>
          {hasSignal && (
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              Power {detected!.power_db.toFixed(1)} dB
            </div>
          )}
          {!hasSignal && running && (
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Listening…</div>
          )}
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 650, textTransform: "uppercase", letterSpacing: 0.6, color: "var(--text-secondary)", marginBottom: 8 }}>
            Standard CTCSS Tones
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {KNOWN_TONES.map((t) => {
              const match = hasSignal && Math.abs(detected!.tone_hz - t) < 1.0;
              return (
                <span key={t} style={{
                  padding: "4px 10px", borderRadius: 6, fontSize: 11,
                  background: match ? "var(--accent)" : "rgba(255,255,255,0.5)",
                  color: match ? "#fff" : "var(--text-secondary)",
                  fontFamily: "var(--font-mono)",
                  border: "1px solid rgba(0,0,0,0.06)",
                }}>
                  {t.toFixed(1)}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
