import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";

interface AprsPacketEvent {
  src: string;
  dst: string;
  payload_type: string;
  lat: number | null;
  lon: number | null;
  comment: string;
}

export function AprsRxApp() {
  const [packets, setPackets] = useState<AprsPacketEvent[]>([]);

  const handleStart = () =>
    startApp("aprs_rx" as AppId, { center_hz: 144_390_000, lna_gain_db: 32, vga_gain_db: 20, amp_enabled: false });

  useEffect(() => {
    const unlisten = listen<AprsPacketEvent>("aprs_packet", (e) =>
      setPackets((prev) => [e.payload, ...prev].slice(0, 200))
    );
    return () => { unlisten.then((f) => f()); };
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <h2>APRS Receiver — 144.390 MHz</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={handleStart} style={{ padding: "8px 16px", background: "#2a2", color: "#fff", border: "none", borderRadius: 4 }}>Start</button>
        <button onClick={stopApp} style={{ padding: "8px 16px", background: "#555", color: "#fff", border: "none", borderRadius: 4 }}>Stop</button>
        <button onClick={() => setPackets([])} style={{ padding: "8px 16px", background: "#444", color: "#eee", border: "none", borderRadius: 4 }}>Clear</button>
        <span style={{ color: "#888", alignSelf: "center" }}>{packets.length} packets</span>
      </div>
      <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 160px)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#1c1c2c", textAlign: "left" }}>
              <th style={{ padding: "6px 8px" }}>Src</th>
              <th style={{ padding: "6px 8px" }}>Dst</th>
              <th style={{ padding: "6px 8px" }}>Type</th>
              <th style={{ padding: "6px 8px" }}>Lat</th>
              <th style={{ padding: "6px 8px" }}>Lon</th>
              <th style={{ padding: "6px 8px" }}>Comment</th>
            </tr>
          </thead>
          <tbody>
            {packets.map((p, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #222" }}>
                <td style={{ padding: "4px 8px", fontFamily: "monospace" }}>{p.src}</td>
                <td style={{ padding: "4px 8px", fontFamily: "monospace" }}>{p.dst}</td>
                <td style={{ padding: "4px 8px" }}>{p.payload_type}</td>
                <td style={{ padding: "4px 8px" }}>{p.lat != null ? p.lat.toFixed(5) : "—"}</td>
                <td style={{ padding: "4px 8px" }}>{p.lon != null ? p.lon.toFixed(5) : "—"}</td>
                <td style={{ padding: "4px 8px", color: "#aaa" }}>{p.comment}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
