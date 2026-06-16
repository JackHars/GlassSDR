import { useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";
import { RecordBar } from "../../components/RecordBar";
import { AppScreen } from "../../components/kit/AppScreen";
import type { AppStatus } from "../../components/kit/AppScreen";
import "./ErtRx.css";

interface ErtMeterEvent { meter_id: number; meter_type: string; consumption: number; }

export function ErtRxApp() {
  const [freqHz, setFreqHz] = useState(912_600_000);
  const [readings, setReadings] = useState<ErtMeterEvent[]>([]);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const p = listen<ErtMeterEvent>("ert_meter", (e) =>
      setReadings((prev) => [e.payload, ...prev].slice(0, 200))
    );
    return () => { p.then((f) => f()); };
  }, []);

  const handleStart = async () => {
    await startApp("ert_rx" as AppId, { center_hz: freqHz, lna_gain_db: 32, vga_gain_db: 20, amp_enabled: false });
    setRunning(true);
  };
  const handleStop = async () => { await stopApp(); setRunning(false); };

  // Latest reading per meter
  const latestPerMeter = useMemo(() => {
    const m = new Map<number, ErtMeterEvent>();
    for (const r of readings) { if (!m.has(r.meter_id)) m.set(r.meter_id, r); }
    return Array.from(m.values());
  }, [readings]);

  const count = readings.length;
  const appStatus: AppStatus = running ? (count > 0 ? "live" : "acquiring") : "idle";

  return (
    <AppScreen
      appId="ert_rx"
      title="ERT Meter Reader"
      subtitle="912.6 MHz · ISM"
      status={appStatus}
      statusText={running ? (count > 0 ? `${count} readings` : "Listening") : "Idle"}
      controls={
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "12px 16px", width: "100%" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label className="app-shell__field-label">Frequency (Hz)</label>
            <input type="number" value={freqHz} style={{ width: 130 }} onChange={(e) => setFreqHz(+e.target.value)} />
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignSelf: "flex-end" }}>
            <button className="glass-btn primary" onClick={handleStart} disabled={running}>Start</button>
            <button className="glass-btn" onClick={handleStop} disabled={!running}>Stop</button>
            <button className="glass-btn" onClick={() => setReadings([])}>Clear</button>
          </div>
        </div>
      }
      footer={<RecordBar appId={"ert_rx" as Parameters<typeof RecordBar>[0]["appId"]} format="jsonl" centerHz={freqHz} />}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: "1 1 auto", minHeight: 0 }}>
        <div className="ert-stats">
          <div className="ert-stat"><span className="ert-stat-label">Readings</span><span className="ert-stat-value">{count}</span></div>
          <div className="ert-stat"><span className="ert-stat-label">Meters</span><span className="ert-stat-value">{latestPerMeter.length}</span></div>
        </div>
        {latestPerMeter.length === 0 ? (
          <div style={{ flex: "1 1 auto", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)", fontSize: 13, fontStyle: "italic" }}>
            No meter readings — listening on 912.6 MHz ISM band
          </div>
        ) : (
          <div className="ert-meter-grid" style={{ overflowY: "auto", flex: "1 1 auto" }}>
            {latestPerMeter.map((m) => (
              <div key={m.meter_id} className="ert-meter-card">
                <div className="ert-meter-id">ID {m.meter_id}</div>
                <div className="ert-meter-type">{m.meter_type}</div>
                <div className="ert-meter-value">{m.consumption.toLocaleString()}<span className="ert-meter-unit">units</span></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppScreen>
  );
}
