import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";
import { RecordBar } from "../../components/RecordBar";
import { AppShell, ControlField, ControlRow } from "../../components/AppShell";
import { DecoderTable } from "../../components/DecoderTable";

interface TpmsSensorEvent { sensor_id: number; pressure_kpa: number; temp_c: number; }

const FREQS = [
  { label: "315 MHz", hz: 315_000_000 },
  { label: "433.92 MHz", hz: 433_920_000 },
];

export function TpmsRxApp() {
  const [sensors, setSensors] = useState<TpmsSensorEvent[]>([]);
  const [freqIdx, setFreqIdx] = useState(1);
  const [running, setRunning] = useState(false);

  const handleStart = async () => {
    await startApp("tpms_rx" as AppId, {
      center_hz: FREQS[freqIdx].hz, lna_gain_db: 40, vga_gain_db: 20, amp_enabled: false,
    });
    setRunning(true);
  };
  const handleStop = async () => { await stopApp(); setRunning(false); };

  useEffect(() => {
    const unlisten = listen<TpmsSensorEvent>("tpms_sensor", (e) =>
      setSensors((prev) => {
        const idx = prev.findIndex((s) => s.sensor_id === e.payload.sensor_id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = e.payload;
          return next;
        }
        return [e.payload, ...prev].slice(0, 100);
      })
    );
    return () => { unlisten.then((f) => f()); };
  }, []);

  return (
    <AppShell
      title="TPMS Receiver"
      status={running ? <><span style={{color: "#34C759"}}>●</span> Listening · {sensors.length} sensors</> : <><span style={{color: "#999"}}>○</span> Idle</>}
      controls={
        <ControlRow
          actions={
            <>
              <button className="glass-btn primary" onClick={handleStart} disabled={running}>Start</button>
              <button className="glass-btn" onClick={handleStop} disabled={!running}>Stop</button>
              <button className="glass-btn" onClick={() => setSensors([])}>Clear</button>
            </>
          }
        >
          <ControlField label="Frequency" size="md">
            <select value={freqIdx} onChange={(e) => setFreqIdx(Number(e.target.value))}>
              {FREQS.map((f, i) => (
                <option key={f.label} value={i}>{f.label}</option>
              ))}
            </select>
          </ControlField>
        </ControlRow>
      }
      footer={<RecordBar appId={"tpms_rx" as any} format="jsonl" centerHz={FREQS[freqIdx].hz} />}
    >
      <DecoderTable
        headers={["Sensor ID", "Pressure (kPa)", "Temp (°C)"]}
        rows={sensors}
        rowKey={(s) => s.sensor_id}
        renderRow={(s) => [s.sensor_id.toString(16).toUpperCase().padStart(8, "0"), s.pressure_kpa.toFixed(1), s.temp_c.toFixed(1)]}
        emptyMessage="No sensors detected — TPMS frames are bursty; you may need to be near vehicles."
      />
    </AppShell>
  );
}
