import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";
import { RecordBar } from "../../components/RecordBar";
import { AppScreen } from "../../components/kit/AppScreen";
import type { AppStatus } from "../../components/kit/AppScreen";
import "./CtcssDcs.css";

interface CtcssDetectEvent { tone_hz: number; power_db: number; }

const KNOWN_TONES = [
  67.0,71.9,74.4,77.0,79.7,82.5,85.4,88.5,91.5,94.8,97.4,100.0,
  103.5,107.2,110.9,114.8,118.8,123.0,127.3,131.8,136.5,141.3,146.2,
  151.4,156.7,162.2,167.9,173.8,179.9,186.2,192.8,203.5,210.7,218.1,
  225.7,233.6,241.8,250.3,
];

function nearestTone(hz: number): string {
  const closest = KNOWN_TONES.reduce((a, b) => Math.abs(b - hz) < Math.abs(a - hz) ? b : a);
  return Math.abs(closest - hz) < 1.0 ? `${closest.toFixed(1)} Hz` : `${hz.toFixed(1)} Hz`;
}

export function CtcssDcsApp() {
  const [centerHz, setCenterHz] = useState(146_520_000);
  const [running, setRunning] = useState(false);
  const [detected, setDetected] = useState<CtcssDetectEvent | null>(null);

  useEffect(() => {
    const p = listen<CtcssDetectEvent>("ctcss_detect", (e) => {
      if (e.payload.tone_hz > 0) setDetected(e.payload);
    });
    return () => { p.then((f) => f()); };
  }, []);

  const start = async () => {
    setDetected(null);
    await startApp("ctcss_dcs" as AppId, { center_hz: centerHz });
    setRunning(true);
  };
  const stop = async () => { await stopApp(); setRunning(false); };

  const hasSignal = detected && detected.tone_hz > 0;
  const appStatus: AppStatus = running ? (hasSignal ? "live" : "acquiring") : "idle";

  return (
    <AppScreen
      appId="ctcss_dcs"
      title="CTCSS / DCS"
      subtitle={`${(centerHz / 1e6).toFixed(4)} MHz`}
      status={appStatus}
      statusText={running ? (hasSignal ? `${detected!.tone_hz.toFixed(1)} Hz` : "Listening") : "Idle"}
      controls={
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "12px 16px", width: "100%" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label className="app-shell__field-label">Frequency (Hz)</label>
            <input type="number" value={centerHz} style={{ width: 130 }} onChange={(e) => setCenterHz(+e.target.value)} />
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignSelf: "flex-end" }}>
            <button className="glass-btn primary" onClick={start} disabled={running}>Start</button>
            <button className="glass-btn" onClick={stop} disabled={!running}>Stop</button>
          </div>
        </div>
      }
      footer={<RecordBar appId={"ctcss_dcs" as Parameters<typeof RecordBar>[0]["appId"]} format="jsonl" centerHz={centerHz} />}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: "1 1 auto", minHeight: 0, overflowY: "auto" }}>
        {/* Tone display */}
        <div className="ctcss-tone-display">
          <span className="ctcss-tone-label">Detected Tone</span>
          <div className={`ctcss-tone-freq${hasSignal ? " ctcss-tone-freq--active" : " ctcss-tone-freq--empty"}`}>
            {hasSignal ? nearestTone(detected!.tone_hz) : "—"}
          </div>
          {hasSignal && <div className="ctcss-tone-power">Power {detected!.power_db.toFixed(1)} dB</div>}
          {!hasSignal && running && <div style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Listening for sub-audible tones…</div>}
        </div>
        {/* Tone grid */}
        <span className="ctcss-grid-label">Standard CTCSS Tones</span>
        <div className="ctcss-tone-grid">
          {KNOWN_TONES.map((t) => {
            const match = hasSignal && Math.abs(detected!.tone_hz - t) < 1.0;
            return <span key={t} className={`ctcss-tone-chip${match ? " match" : ""}`}>{t.toFixed(1)}</span>;
          })}
        </div>
      </div>
    </AppScreen>
  );
}
