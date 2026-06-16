/** Shared inner component for satellite imaging 🧩 cluster (APT/HRPT/LRPT). */
import { useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";
import { RecordBar } from "../../components/RecordBar";
import { AppScreen } from "../../components/kit/AppScreen";
import type { AppStatus } from "../../components/kit/AppScreen";
import type { AllAppId } from "../../theme/appThemes";
import "./SatImageRx.css";

interface AptLineEvent { line_number: number; channel: string; pixels_len: number; }

const EXPECTED_LINES: Record<string, number> = {
  apt_rx: 900, hrpt_rx: 2048, lrpt_rx: 1536,
};

interface Props {
  appId: AllAppId;
  title: string;
  defaultFreqHz: number;
  event: string;
  subtitle?: string;
}

export function SatImageRxInner({ appId, title, defaultFreqHz, event, subtitle }: Props) {
  const [freqHz, setFreqHz] = useState(defaultFreqHz);
  const [lines, setLines] = useState<AptLineEvent[]>([]);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const p = listen<AptLineEvent>(event, (e) =>
      setLines((prev) => [e.payload, ...prev].slice(0, 2000))
    );
    return () => { p.then((f) => f()); };
  }, [event]);

  const handleStart = async () => {
    await startApp(appId as AppId, { center_hz: freqHz, lna_gain_db: 32, vga_gain_db: 20, amp_enabled: false });
    setRunning(true);
  };
  const handleStop = async () => { await stopApp(); setRunning(false); };

  const total = lines.length;
  const expected = EXPECTED_LINES[appId] ?? 1000;
  const pct = Math.min(100, (total / expected) * 100);

  // Unique channels seen
  const channels = useMemo(() => {
    const s = new Set<string>();
    for (const l of lines) s.add(l.channel);
    return Array.from(s);
  }, [lines]);

  // Last 50 lines for scanline grid display
  const gridLines = useMemo(() => lines.slice(0, 50).reverse(), [lines]);

  const appStatus: AppStatus = running ? (total > 0 ? "live" : "acquiring") : "idle";

  return (
    <AppScreen
      appId={appId}
      title={title}
      subtitle={subtitle ?? `${(freqHz / 1e6).toFixed(3)} MHz`}
      status={appStatus}
      statusText={running ? (total > 0 ? `${total} lines` : "Awaiting pass") : "Idle"}
      controls={
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "12px 16px", width: "100%" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label className="app-shell__field-label">Frequency (Hz)</label>
            <input type="number" value={freqHz} style={{ width: 140 }} onChange={(e) => setFreqHz(+e.target.value)} />
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignSelf: "flex-end" }}>
            <button className="glass-btn primary" onClick={handleStart} disabled={running}>Start</button>
            <button className="glass-btn" onClick={handleStop} disabled={!running}>Stop</button>
            <button className="glass-btn" onClick={() => setLines([])}>Clear</button>
          </div>
        </div>
      }
      footer={<RecordBar appId={appId as Parameters<typeof RecordBar>[0]["appId"]} format="img" centerHz={freqHz} />}
    >
      {total === 0 ? (
        <div className="satimg-waiting">
          <span className="satimg-waiting-icon">🛰️</span>
          <span className="satimg-waiting-text">Awaiting satellite pass — image builds line by line during overhead transit</span>
        </div>
      ) : (
        <div className="satimg-pass-panel" style={{ position: "relative", overflow: "hidden", flex: "1 1 auto" }}>
          <div className="satimg-scanline-motif" aria-hidden />
          {/* Stats */}
          <div className="satimg-stats">
            <div className="satimg-stat">
              <span className="satimg-stat-label">Lines</span>
              <span className="satimg-stat-value">{total}</span>
            </div>
            {lines[0] && (
              <div className="satimg-stat">
                <span className="satimg-stat-label">Width</span>
                <span className="satimg-stat-value">{lines[0].pixels_len} px</span>
              </div>
            )}
          </div>
          {/* Line counter */}
          <div>
            <span className="satimg-line-label">Current line</span>
            <div className="satimg-line-count">{lines[0]?.line_number ?? 0}</div>
          </div>
          {/* Progress */}
          <div className="satimg-progress-track">
            <div className="satimg-progress-fill" style={{ width: `${pct}%` }} />
          </div>
          {/* Channels */}
          {channels.length > 0 && (
            <div className="satimg-channels">
              {channels.map((c) => <div key={c} className="satimg-channel">{c}</div>)}
            </div>
          )}
          {/* Scanline grid */}
          <div className="satimg-scanline-grid">
            {gridLines.map((l, i) => (
              <div
                key={i}
                className={`satimg-scanline ch-${l.channel.toLowerCase()}`}
                style={{ width: Math.max(4, (l.pixels_len / 10)) + "px" }}
              />
            ))}
          </div>
        </div>
      )}
    </AppScreen>
  );
}
