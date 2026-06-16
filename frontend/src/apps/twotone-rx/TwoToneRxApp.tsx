import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";
import { RecordBar } from "../../components/RecordBar";
import { DecoderFeed } from "../../components/kit/DecoderFeed";
import type { DecoderColumn } from "../../components/kit/DecoderFeed";
import { AppScreen } from "../../components/kit/AppScreen";
import type { AppStatus } from "../../components/kit/AppScreen";
import "./TwoToneRx.css";

interface TwoToneEvent { tone_a_hz: number; tone_b_hz: number; timestamp_ms: number; }
type Alert = TwoToneEvent & { id: number };
let _id = 0;

const COLS: DecoderColumn<Alert>[] = [
  { key: "tone_a_hz", label: "Tone A (Hz)", width: "100px", mono: true, render: (a) => a.tone_a_hz.toFixed(1) },
  { key: "tone_b_hz", label: "Tone B (Hz)", width: "100px", mono: true, render: (a) => a.tone_b_hz.toFixed(1) },
  { key: "timestamp_ms", label: "Time", render: (a) => new Date(a.timestamp_ms).toLocaleTimeString() },
];

export function TwoToneRxApp() {
  const [freqHz, setFreqHz] = useState(154_400_000);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [lastAlert, setLastAlert] = useState<Alert | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const p = listen<TwoToneEvent>("two_tone_alert", (e) => {
      const alert: Alert = { ...e.payload, id: ++_id };
      setAlerts((prev) => [alert, ...prev].slice(0, 200));
      setLastAlert(alert);
      const t = setTimeout(() => setLastAlert(null), 8000);
      return () => clearTimeout(t);
    });
    return () => { p.then((f) => f()); };
  }, []);

  const handleStart = async () => {
    await startApp("two_tone_rx" as AppId, { center_hz: freqHz, lna_gain_db: 32, vga_gain_db: 20, amp_enabled: false });
    setRunning(true);
  };
  const handleStop = async () => { await stopApp(); setRunning(false); };

  const appStatus: AppStatus = running ? (lastAlert ? "live" : alerts.length > 0 ? "acquiring" : "idle") : "idle";

  return (
    <AppScreen
      appId="two_tone_rx"
      title="Two-Tone Pager"
      subtitle={`${(freqHz / 1e6).toFixed(3)} MHz`}
      status={appStatus}
      statusText={running ? (lastAlert ? "ALERT" : alerts.length > 0 ? `${alerts.length} alerts` : "Monitoring") : "Idle"}
      controls={
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "12px 16px", width: "100%" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label className="app-shell__field-label">Frequency (Hz)</label>
            <input type="number" value={freqHz} style={{ width: 130 }} onChange={(e) => setFreqHz(+e.target.value)} />
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignSelf: "flex-end" }}>
            <button className="glass-btn primary" onClick={handleStart} disabled={running}>Start</button>
            <button className="glass-btn" onClick={handleStop} disabled={!running}>Stop</button>
            <button className="glass-btn" onClick={() => { setAlerts([]); setLastAlert(null); }}>Clear</button>
          </div>
        </div>
      }
      footer={<RecordBar appId={"two_tone_rx" as Parameters<typeof RecordBar>[0]["appId"]} format="jsonl" centerHz={freqHz} />}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: "1 1 auto", minHeight: 0 }}>
        {/* Alarm visual */}
        <div className={`twotone-alarm-panel${lastAlert ? " active" : ""}`}>
          <div className="twotone-alarm-icon">{lastAlert ? "🚨" : "🔕"}</div>
          {lastAlert ? (
            <div className="twotone-alarm-tones">
              <div className="twotone-tone">
                <span className="twotone-tone-label">Tone A</span>
                <span className="twotone-tone-freq">{lastAlert.tone_a_hz.toFixed(1)}</span>
                <span className="twotone-tone-unit">Hz</span>
              </div>
              <div className="twotone-tone">
                <span className="twotone-tone-label">Tone B</span>
                <span className="twotone-tone-freq">{lastAlert.tone_b_hz.toFixed(1)}</span>
                <span className="twotone-tone-unit">Hz</span>
              </div>
            </div>
          ) : (
            <span style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Listening for two-tone sequences</span>
          )}
        </div>
        {/* Alert history */}
        <div className="twotone-stats">
          <div className="twotone-stat"><span className="twotone-stat-label">Alerts</span><span className="twotone-stat-value">{alerts.length}</span></div>
        </div>
        <DecoderFeed items={alerts} columns={COLS} emptyLabel="No alerts yet" emptyIcon="📻" />
      </div>
    </AppScreen>
  );
}
