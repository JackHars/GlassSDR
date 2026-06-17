import { useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";
import { RecordBar } from "../../components/RecordBar";
import { AppScreen } from "../../components/kit/AppScreen";
import type { AppStatus } from "../../components/kit/AppScreen";
import "./WeatherRx.css";

interface WeatherEvent { sensor_id: number; channel: number; temp_c: number | null; humidity: number | null; }

export function WeatherRxApp() {
  const [freqHz, setFreqHz] = useState(433_920_000);
  const [readings, setReadings] = useState<WeatherEvent[]>([]);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const p = listen<WeatherEvent>("weather_reading", (e) =>
      setReadings((prev) => [e.payload, ...prev].slice(0, 200))
    );
    return () => { p.then((f) => f()); };
  }, []);

  const handleStart = async () => {
    await startApp("weather_rx" as AppId, { center_hz: freqHz, lna_gain_db: 32, vga_gain_db: 20, amp_enabled: false });
    setRunning(true);
  };
  const handleStop = async () => { await stopApp(); setRunning(false); };

  // Latest reading per sensor
  const latestPerSensor = useMemo(() => {
    const m = new Map<number, WeatherEvent>();
    for (const r of readings) { if (!m.has(r.sensor_id)) m.set(r.sensor_id, r); }
    return Array.from(m.values());
  }, [readings]);

  const appStatus: AppStatus = running ? (readings.length > 0 ? "live" : "acquiring") : "idle";

  return (
    <AppScreen
      appId="weather_rx"
      title="Weather Station RX"
      subtitle={`${(freqHz / 1e6).toFixed(3)} MHz · ISM`}
      status={appStatus}
      statusText={running ? (readings.length > 0 ? `${readings.length} readings` : "Scanning") : "Idle"}
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
      footer={<RecordBar appId={"weather_rx" as Parameters<typeof RecordBar>[0]["appId"]} format="jsonl" centerHz={freqHz} />}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: "1 1 auto", minHeight: 0 }}>
        <div className="wx-stats">
          <div className="wx-stat"><span className="wx-stat-label">Readings</span><span className="wx-stat-value">{readings.length}</span></div>
          <div className="wx-stat"><span className="wx-stat-label">Sensors</span><span className="wx-stat-value">{latestPerSensor.length}</span></div>
        </div>
        {latestPerSensor.length === 0 ? (
          <div style={{ flex: "1 1 auto", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)", fontSize: 13, fontStyle: "italic" }}>
            No weather sensors detected yet
          </div>
        ) : (
          <div className="wx-sensor-grid" style={{ overflowY: "auto", flex: "1 1 auto" }}>
            {latestPerSensor.map((r) => (
              <div key={r.sensor_id} className="wx-sensor-card">
                <div className="wx-sensor-id">Sensor {r.sensor_id}</div>
                <div className="wx-sensor-ch">Ch {r.channel}</div>
                <div className="wx-sensor-temp">
                  {r.temp_c != null ? r.temp_c.toFixed(1) : "—"}<span className="wx-unit">°C</span>
                </div>
                <div className="wx-sensor-humid">
                  {r.humidity != null ? `${r.humidity}%` : "—"}<span className="wx-unit">RH</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppScreen>
  );
}
