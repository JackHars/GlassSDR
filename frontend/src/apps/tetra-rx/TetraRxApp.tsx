import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";

interface DigitalVoiceEvent {
  protocol: string;
  talkgroup: number;
  source_id: number;
  call_type: string;
}

interface TetraRow extends DigitalVoiceEvent {
  mcc: number;
  mnc: number;
}

export function TetraRxApp() {
  const [freq, setFreq] = useState("380000000");
  const [rows, setRows] = useState<TetraRow[]>([]);

  const handleStart = () =>
    startApp("tetra_rx" as AppId, { center_hz: parseFloat(freq), lna_gain_db: 32, vga_gain_db: 20, amp_enabled: false });

  useEffect(() => {
    const unlisten = listen<DigitalVoiceEvent>("digital_voice", (e) => {
      if (e.payload.protocol === "TETRA") {
        const row: TetraRow = { ...e.payload, mcc: 0, mnc: 0 };
        setRows((prev) => [row, ...prev].slice(0, 200));
      }
    });
    return () => { unlisten.then((f) => f()); };
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <h2>Tetra RX</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
        <label>Freq (Hz):</label>
        <input
          type="number"
          value={freq}
          onChange={(e) => setFreq(e.target.value)}
          style={{ width: 140, padding: "4px 8px", background: "#222", color: "#eee", border: "1px solid #444" }}
        />
        <button onClick={handleStart} style={{ padding: "8px 16px", background: "#2a2", color: "#fff", border: "none", borderRadius: 4 }}>Start</button>
        <button onClick={stopApp} style={{ padding: "8px 16px", background: "#555", color: "#fff", border: "none", borderRadius: 4 }}>Stop</button>
        <button onClick={() => setRows([])} style={{ padding: "8px 16px", background: "#444", color: "#eee", border: "none", borderRadius: 4 }}>Clear</button>
        <span style={{ color: "#888" }}>{rows.length} calls</span>
      </div>
      <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 160px)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#1c1c2c", textAlign: "left" }}>
              <th style={{ padding: "6px 8px" }}>MCC</th>
              <th style={{ padding: "6px 8px" }}>MNC</th>
              <th style={{ padding: "6px 8px" }}>SSI (Source)</th>
              <th style={{ padding: "6px 8px" }}>Type</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #222" }}>
                <td style={{ padding: "4px 8px" }}>{r.mcc}</td>
                <td style={{ padding: "4px 8px" }}>{r.mnc}</td>
                <td style={{ padding: "4px 8px", fontFamily: "monospace" }}>{r.source_id}</td>
                <td style={{ padding: "4px 8px", color: "#aaa" }}>{r.call_type}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
