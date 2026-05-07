import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";
import { RecordBar } from "../../components/RecordBar";
import { AppShell, ControlRow } from "../../components/AppShell";
import { DecoderTable } from "../../components/DecoderTable";

interface AisShipEvent {
  mmsi: number;
  name: string | null;
  lat: number;
  lon: number;
  speed_kt: number;
  course: number;
}

export function AisRxApp() {
  const [ships, setShips] = useState<Map<number, AisShipEvent>>(new Map());
  const [running, setRunning] = useState(false);

  const handleStart = async () => {
    await startApp("ais_rx" as AppId, { center_hz: 161_975_000, lna_gain_db: 32, vga_gain_db: 20, amp_enabled: false });
    setRunning(true);
  };
  const handleStop = async () => { await stopApp(); setRunning(false); };

  useEffect(() => {
    const unlisten = listen<AisShipEvent>("ais_ship", (e) =>
      setShips((prev) => new Map(prev).set(e.payload.mmsi, e.payload))
    );
    return () => { unlisten.then((f) => f()); };
  }, []);

  const rows = Array.from(ships.values());

  return (
    <AppShell
      title="AIS Receiver"
      status={running ? <><span style={{color: "#34C759"}}>●</span> Listening · 161.975 MHz · {rows.length} vessels</> : <><span style={{color: "#999"}}>○</span> Idle</>}
      controls={
        <ControlRow
          actions={
            <>
              <button className="glass-btn primary" onClick={handleStart} disabled={running}>Start</button>
              <button className="glass-btn" onClick={handleStop} disabled={!running}>Stop</button>
              <button className="glass-btn" onClick={() => setShips(new Map())}>Clear</button>
            </>
          }
        >
          <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>
            Marine VHF · channels A (161.975) and B (162.025)
          </span>
        </ControlRow>
      }
      footer={<RecordBar appId={"ais_rx" as any} format="jsonl" centerHz={161_975_000} />}
    >
      <DecoderTable
        headers={["MMSI", "Name", "Lat", "Lon", "Speed (kt)", "Course"]}
        rows={rows}
        rowKey={(s) => s.mmsi}
        renderRow={(s) => [s.mmsi, s.name ?? "—", s.lat.toFixed(5), s.lon.toFixed(5), s.speed_kt.toFixed(1), s.course.toFixed(1)]}
        emptyMessage="No vessels yet — press Start to listen."
      />
    </AppShell>
  );
}
