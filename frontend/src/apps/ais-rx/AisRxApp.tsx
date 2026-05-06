import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";

interface AisShipEvent {
  mmsi: number;
  name: string | null;
  lat: number;
  lon: number;
  speed_kt: number;
  course: number;
}

export function AisRxApp() {
  // Keyed by MMSI for deduplication / live update
  const [ships, setShips] = useState<Map<number, AisShipEvent>>(new Map());

  const handleStart = () =>
    startApp("ais_rx" as AppId, { center_hz: 161_975_000, lna_gain_db: 32, vga_gain_db: 20, amp_enabled: false });

  useEffect(() => {
    const unlisten = listen<AisShipEvent>("ais_ship", (e) =>
      setShips((prev) => new Map(prev).set(e.payload.mmsi, e.payload))
    );
    return () => { unlisten.then((f) => f()); };
  }, []);

  const rows = Array.from(ships.values());

  return (
    <div style={{ padding: 16 }}>
      <h2>AIS Receiver — 161.975 MHz</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={handleStart} style={{ padding: "8px 16px", background: "#2a2", color: "#fff", border: "none", borderRadius: 4 }}>Start</button>
        <button onClick={stopApp} style={{ padding: "8px 16px", background: "#555", color: "#fff", border: "none", borderRadius: 4 }}>Stop</button>
        <button onClick={() => setShips(new Map())} style={{ padding: "8px 16px", background: "#444", color: "#eee", border: "none", borderRadius: 4 }}>Clear</button>
        <span style={{ color: "#888", alignSelf: "center" }}>{rows.length} vessels</span>
      </div>
      <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 160px)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#1c1c2c", textAlign: "left" }}>
              <th style={{ padding: "6px 8px" }}>MMSI</th>
              <th style={{ padding: "6px 8px" }}>Name</th>
              <th style={{ padding: "6px 8px" }}>Lat</th>
              <th style={{ padding: "6px 8px" }}>Lon</th>
              <th style={{ padding: "6px 8px" }}>Speed (kt)</th>
              <th style={{ padding: "6px 8px" }}>Course</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.mmsi} style={{ borderBottom: "1px solid #222" }}>
                <td style={{ padding: "4px 8px", fontFamily: "monospace" }}>{s.mmsi}</td>
                <td style={{ padding: "4px 8px" }}>{s.name ?? "—"}</td>
                <td style={{ padding: "4px 8px" }}>{s.lat.toFixed(5)}</td>
                <td style={{ padding: "4px 8px" }}>{s.lon.toFixed(5)}</td>
                <td style={{ padding: "4px 8px" }}>{s.speed_kt.toFixed(1)}</td>
                <td style={{ padding: "4px 8px" }}>{s.course.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
