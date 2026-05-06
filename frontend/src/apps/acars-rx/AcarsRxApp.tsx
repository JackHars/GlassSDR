import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";

interface AcarsMessageEvent {
  reg: string;
  flight: string;
  label: string;
  text: string;
}

export function AcarsRxApp() {
  const [freq, setFreq] = useState("129125000");
  const [messages, setMessages] = useState<AcarsMessageEvent[]>([]);

  const handleStart = () =>
    startApp("acars_rx" as AppId, { center_hz: parseFloat(freq), lna_gain_db: 32, vga_gain_db: 20, amp_enabled: false });

  useEffect(() => {
    const unlisten = listen<AcarsMessageEvent>("acars_message", (e) =>
      setMessages((prev) => [e.payload, ...prev].slice(0, 200))
    );
    return () => { unlisten.then((f) => f()); };
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <h2>ACARS Receiver</h2>
      <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8, maxWidth: 400, marginBottom: 12 }}>
        <label>Frequency (Hz)</label>
        <input
          value={freq}
          onChange={(e) => setFreq(e.target.value)}
          style={{ background: "#222", color: "#eee", border: "1px solid #444", padding: 4 }}
        />
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={handleStart} style={{ padding: "8px 16px", background: "#2a2", color: "#fff", border: "none", borderRadius: 4 }}>Start</button>
        <button onClick={stopApp} style={{ padding: "8px 16px", background: "#555", color: "#fff", border: "none", borderRadius: 4 }}>Stop</button>
        <button onClick={() => setMessages([])} style={{ padding: "8px 16px", background: "#444", color: "#eee", border: "none", borderRadius: 4 }}>Clear</button>
        <span style={{ color: "#888", alignSelf: "center" }}>{messages.length} messages</span>
      </div>
      <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 200px)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#1c1c2c", textAlign: "left" }}>
              <th style={{ padding: "6px 8px" }}>Reg</th>
              <th style={{ padding: "6px 8px" }}>Flight</th>
              <th style={{ padding: "6px 8px" }}>Label</th>
              <th style={{ padding: "6px 8px" }}>Text</th>
            </tr>
          </thead>
          <tbody>
            {messages.map((m, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #222" }}>
                <td style={{ padding: "4px 8px", fontFamily: "monospace" }}>{m.reg}</td>
                <td style={{ padding: "4px 8px", fontFamily: "monospace" }}>{m.flight}</td>
                <td style={{ padding: "4px 8px" }}>{m.label}</td>
                <td style={{ padding: "4px 8px", color: "#ccc", fontFamily: "monospace", wordBreak: "break-all" }}>{m.text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
