import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";

interface AircraftState {
  icao24: string;
  callsign?: string;
  position?: { lat: number; lon: number; altitude_ft?: number };
  velocity?: { ground_speed_kt: number; heading_deg: number; vert_rate_fpm: number };
  last_seen_ms: number;
}

export function AdsbExtApp() {
  const [aircraft, setAircraft] = useState<Map<string, AircraftState>>(new Map());

  const handleStart = () =>
    startApp("adsb_rx_ext" as AppId, { lna_gain_db: 40, vga_gain_db: 40 });

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
    <div style={{ padding: 16 }}>
      <h2>ADS-B Extended</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
        <button onClick={handleStart} style={{ padding: "8px 16px", background: "#2a2", color: "#fff", border: "none", borderRadius: 4 }}>Start</button>
        <button onClick={stopApp} style={{ padding: "8px 16px", background: "#555", color: "#fff", border: "none", borderRadius: 4 }}>Stop</button>
        <button onClick={() => setAircraft(new Map())} style={{ padding: "8px 16px", background: "#444", color: "#eee", border: "none", borderRadius: 4 }}>Clear</button>
        <span style={{ color: "#888" }}>{rows.length} aircraft</span>
      </div>
      <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 160px)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#1c1c2c", textAlign: "left" }}>
              <th style={{ padding: "6px 8px" }}>ICAO24</th>
              <th style={{ padding: "6px 8px" }}>Callsign</th>
              <th style={{ padding: "6px 8px" }}>Lat</th>
              <th style={{ padding: "6px 8px" }}>Lon</th>
              <th style={{ padding: "6px 8px" }}>Alt (ft)</th>
              <th style={{ padding: "6px 8px" }}>Speed (kt)</th>
              <th style={{ padding: "6px 8px" }}>Heading</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.icao24} style={{ borderBottom: "1px solid #222" }}>
                <td style={{ padding: "4px 8px", fontFamily: "monospace" }}>{a.icao24}</td>
                <td style={{ padding: "4px 8px" }}>{a.callsign ?? "—"}</td>
                <td style={{ padding: "4px 8px" }}>{a.position ? a.position.lat.toFixed(4) : "—"}</td>
                <td style={{ padding: "4px 8px" }}>{a.position ? a.position.lon.toFixed(4) : "—"}</td>
                <td style={{ padding: "4px 8px" }}>{a.position?.altitude_ft ?? "—"}</td>
                <td style={{ padding: "4px 8px" }}>{a.velocity ? a.velocity.ground_speed_kt.toFixed(0) : "—"}</td>
                <td style={{ padding: "4px 8px" }}>{a.velocity ? a.velocity.heading_deg.toFixed(0) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
