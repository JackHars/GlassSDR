import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";
import { RecordBar } from "../../components/RecordBar";
import { AppShell, ControlField, ControlRow } from "../../components/AppShell";
import { DecoderTable } from "../../components/DecoderTable";

interface WeatherEvent {
  sensor_id: number;
  channel: number;
  temp_c: number | null;
  humidity: number | null;
}

export function WeatherRxApp() {
  const [freq, setFreq] = useState(433_920_000);
  const [readings, setReadings] = useState<WeatherEvent[]>([]);
  const [running, setRunning] = useState(false);

  const handleStart = async () => {
    await startApp("weather_rx" as AppId, { center_hz: freq, lna_gain_db: 32, vga_gain_db: 20, amp_enabled: false });
    setRunning(true);
  };
  const handleStop = async () => { await stopApp(); setRunning(false); };

  useEffect(() => {
    const unlisten = listen<WeatherEvent>("weather_reading", (e) =>
      setReadings((prev) => [e.payload, ...prev].slice(0, 200))
    );
    return () => { unlisten.then((f) => f()); };
  }, []);

  return (
    <AppShell
      title="Weather Station RX"
      status={running ? <><span style={{color: "#34C759"}}>●</span> Listening · {readings.length} readings</> : <><span style={{color: "#999"}}>○</span> Idle</>}
      controls={
        <ControlRow
          actions={
            <>
              <button className="glass-btn primary" onClick={handleStart} disabled={running}>Start</button>
              <button className="glass-btn" onClick={handleStop} disabled={!running}>Stop</button>
              <button className="glass-btn" onClick={() => setReadings([])}>Clear</button>
            </>
          }
        >
          <ControlField label="Frequency (Hz)" size="lg">
            <input type="number" value={freq} onChange={(e) => setFreq(Number(e.target.value))} />
          </ControlField>
        </ControlRow>
      }
      footer={<RecordBar appId={"weather_rx" as any} format="jsonl" centerHz={freq} />}
    >
      <DecoderTable
        headers={["Sensor ID", "Ch", "Temp (°C)", "Humidity (%)"]}
        rows={readings}
        renderRow={(r) => [r.sensor_id, r.channel, r.temp_c != null ? r.temp_c.toFixed(1) : "—", r.humidity != null ? `${r.humidity}` : "—"]}
        emptyMessage="No readings yet — press Start to listen on the chosen ISM frequency."
      />
    </AppShell>
  );
}
