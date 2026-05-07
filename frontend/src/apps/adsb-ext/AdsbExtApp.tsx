import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";
import { RecordBar } from "../../components/RecordBar";
import { AppShell, ControlRow } from "../../components/AppShell";
import { DecoderTable } from "../../components/DecoderTable";

interface AircraftState {
  icao24: string;
  callsign?: string;
  position?: { lat: number; lon: number; altitude_ft?: number };
  velocity?: { ground_speed_kt: number; heading_deg: number; vert_rate_fpm: number };
  last_seen_ms: number;
}

export function AdsbExtApp() {
  const [aircraft, setAircraft] = useState<Map<string, AircraftState>>(new Map());
  const [running, setRunning] = useState(false);

  const handleStart = async () => {
    await startApp("adsb_rx_ext" as AppId, { lna_gain_db: 40, vga_gain_db: 40 });
    setRunning(true);
  };
  const handleStop = async () => { await stopApp(); setRunning(false); };

  useEffect(() => {
    const unlisten = listen<AircraftState>("aircraft_state", (e) => {
      setAircraft((prev) => {
        const next = new Map(prev);
        next.set(e.payload.icao24, e.payload);
        return next;
      });
    });
    return () => { unlisten.then((f) => f()); };
  }, []);

  const rows = Array.from(aircraft.values()).sort((a, b) => b.last_seen_ms - a.last_seen_ms);

  return (
    <AppShell
      title="ADS-B Extended"
      status={running ? <><span style={{color: "#34C759"}}>●</span> Tracking {rows.length} aircraft on 1090 MHz</> : <><span style={{color: "#999"}}>○</span> Idle</>}
      controls={
        <ControlRow
          actions={
            <>
              <button className="glass-btn primary" onClick={handleStart} disabled={running}>Start</button>
              <button className="glass-btn" onClick={handleStop} disabled={!running}>Stop</button>
              <button className="glass-btn" onClick={() => setAircraft(new Map())}>Clear</button>
            </>
          }
        >
          <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>
            Extended squitter decoding · 1090 MHz · adds aircraft type and trail history.
          </span>
        </ControlRow>
      }
      footer={<RecordBar appId={"adsb_rx_ext" as any} format="jsonl" centerHz={1_090_000_000} />}
    >
      <DecoderTable
        headers={["ICAO24", "Callsign", "Lat", "Lon", "Alt (ft)", "Speed (kt)", "Heading"]}
        rows={rows}
        rowKey={(a) => a.icao24}
        renderRow={(a) => [
          a.icao24, a.callsign ?? "—",
          a.position ? a.position.lat.toFixed(4) : "—",
          a.position ? a.position.lon.toFixed(4) : "—",
          a.position?.altitude_ft ?? "—",
          a.velocity ? a.velocity.ground_speed_kt.toFixed(0) : "—",
          a.velocity ? a.velocity.heading_deg.toFixed(0) : "—",
        ]}
        emptyMessage="No aircraft tracked yet — extended decoder needs a few seconds to lock on."
      />
    </AppShell>
  );
}
