import { useState, useEffect } from "react";
import { startApp, stopApp } from "../../ipc/commands";
import { listen } from "@tauri-apps/api/event";
import { RecordBar } from "../../components/RecordBar";
import { AppScreen } from "../../components/kit/AppScreen";
import { Icon } from "../../components/kit/Icon";
import type { AppStatus } from "../../components/kit/AppScreen";
import "./RdsRx.css";

interface RdsData { pi: number; ps: string; rt: string; pty: number; }

// RDS PTY names (EU standard, basic selection)
const PTY_NAMES: Record<number, string> = {
  0: "—", 1: "News", 2: "Affairs", 3: "Info", 4: "Sport",
  5: "Education", 6: "Drama", 7: "Culture", 8: "Science",
  9: "Varied", 10: "Pop", 11: "Rock", 12: "Easy", 13: "Light",
  14: "Classics", 15: "Other Music", 16: "Weather", 17: "Finance",
  18: "Children", 19: "Social", 20: "Religion", 21: "Phone In",
  22: "Travel", 23: "Leisure", 24: "Jazz", 25: "Country",
  26: "National", 27: "Oldies", 28: "Folk", 29: "Documentary",
  30: "Alarm Test", 31: "Alarm",
};

const FM_PRESETS = [
  { label: "88.1", hz: 88_100_000 },
  { label: "98.0", hz: 98_000_000 },
  { label: "104.3", hz: 104_300_000 },
];

export function RdsRxApp() {
  const [freqHz, setFreqHz] = useState(98_000_000);
  const [lna, setLna] = useState(24);
  const [vga, setVga] = useState(20);
  const [rds, setRds] = useState<RdsData | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const p = listen<RdsData>("rds_data", (e) => setRds(e.payload));
    return () => { p.then((fn) => fn()); };
  }, []);

  const handleStart = async (hz = freqHz) => {
    setRds(null);
    await startApp("rds_rx" as Parameters<typeof startApp>[0], {
      center_hz: hz, lna_gain_db: lna, vga_gain_db: vga, amp_enabled: false, stereo: true,
    });
    setRunning(true);
  };
  const handleStop = async () => { await stopApp(); setRunning(false); };

  const appStatus: AppStatus = running ? (rds ? "live" : "acquiring") : "idle";
  const ptyName = rds ? (PTY_NAMES[rds.pty] ?? `PTY${rds.pty}`) : null;

  return (
    <AppScreen
      appId="rds_rx"
      title="RDS Decoder"
      subtitle={`${(freqHz / 1e6).toFixed(1)} MHz · FM`}
      status={appStatus}
      statusText={running ? (rds ? "Locked" : "Searching") : "Idle"}
      controls={
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "12px 16px", width: "100%" }}>
          {/* Frequency input */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label className="app-shell__field-label">Frequency (Hz)</label>
            <input
              type="number"
              value={freqHz}
              style={{ width: 140 }}
              onChange={(e) => setFreqHz(+e.target.value)}
            />
            {/* Quick presets */}
            <div style={{ display: "flex", gap: 5 }}>
              {FM_PRESETS.map((p) => (
                <button
                  key={p.hz}
                  className="glass-btn"
                  style={{ padding: "3px 10px", fontSize: 11, fontFamily: "var(--font-mono)" }}
                  onClick={() => { setFreqHz(p.hz); if (running) handleStart(p.hz); }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label className="app-shell__field-label">LNA {lna} dB</label>
              <input type="range" min={0} max={40} step={8} value={lna} onChange={(e) => setLna(+e.target.value)} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label className="app-shell__field-label">VGA {vga} dB</label>
              <input type="range" min={0} max={62} step={2} value={vga} onChange={(e) => setVga(+e.target.value)} />
            </div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignSelf: "flex-end" }}>
            <button className="glass-btn primary" onClick={() => handleStart()} disabled={running}>Start</button>
            <button className="glass-btn" onClick={handleStop} disabled={!running}>Stop</button>
          </div>
        </div>
      }
      footer={
        <RecordBar appId={"rds_rx" as Parameters<typeof RecordBar>[0]["appId"]} format="jsonl" centerHz={freqHz} />
      }
    >
      {/* Car-radio faceplate — the hero */}
      <div className="rds-faceplate">
        {!running && !rds ? (
          <div className="rds-searching">
            <span className="rds-searching-icon"><Icon name="radio" size={32} /></span>
            <span className="rds-searching-text">Press Start to tune to an FM station</span>
            <span className="rds-searching-sub">88–108 MHz · RDS enabled</span>
          </div>
        ) : !rds ? (
          <div className="rds-searching">
            <span className="rds-searching-icon" style={{ animation: "spin 1.5s linear infinite" }}>⟳</span>
            <span className="rds-searching-text">Searching for RDS signal…</span>
            <span className="rds-searching-sub">{(freqHz / 1e6).toFixed(1)} MHz</span>
          </div>
        ) : (
          <>
            {/* PS name — big segment display */}
            <div className="rds-ps-section">
              <span className="rds-ps-label">Station Name</span>
              <div className={`rds-ps-name${rds.ps ? "" : " rds-ps-name--empty"}`}>
                {rds.ps ? rds.ps.padEnd(8) : "--------"}
              </div>
            </div>

            {/* Status lamps */}
            <div className="rds-lamps">
              <div className={`rds-lamp rds-lamp--${rds.pi ? "on" : "off"}`}>RDS</div>
              {ptyName && ptyName !== "—" && (
                <div className="rds-lamp rds-lamp--on">{ptyName}</div>
              )}
              <div className="rds-lamp rds-lamp--off">TP</div>
              <div className="rds-lamp rds-lamp--off">TA</div>
            </div>

            {/* RadioText */}
            <div className="rds-rt-section">
              <span className="rds-rt-label">Radio Text</span>
              {rds.rt
                ? <div className="rds-rt-text" key={rds.rt}>{rds.rt}</div>
                : <div className="rds-rt-text rds-rt-empty">No Radio Text</div>
              }
            </div>

            {/* Metadata */}
            <div className="rds-meta-row">
              <div className="rds-meta-item">
                <span className="rds-meta-key">PI Code</span>
                <span className="rds-meta-value rds-meta-value--accent">
                  {rds.pi.toString(16).toUpperCase().padStart(4, "0")}
                </span>
              </div>
              <div className="rds-meta-item">
                <span className="rds-meta-key">PTY</span>
                <span className="rds-meta-value">{rds.pty} · {ptyName}</span>
              </div>
              <div className="rds-meta-item">
                <span className="rds-meta-key">Frequency</span>
                <span className="rds-meta-value">{(freqHz / 1e6).toFixed(1)} MHz</span>
              </div>
            </div>
          </>
        )}
      </div>
    </AppScreen>
  );
}
