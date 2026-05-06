import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";

interface PocsagPageEvent {
  ric: number;
  function: number;
  message: string;
}

export function PocsagRxApp() {
  const [freq, setFreq] = useState("439987500");
  const [pages, setPages] = useState<PocsagPageEvent[]>([]);

  const handleStart = () =>
    startApp("pocsag_rx" as AppId, { center_hz: parseFloat(freq), lna_gain_db: 32, vga_gain_db: 20, amp_enabled: false });

  useEffect(() => {
    const unlisten = listen<PocsagPageEvent>("pocsag_page", (e) =>
      setPages((prev) => [e.payload, ...prev].slice(0, 200))
    );
    return () => { unlisten.then((f) => f()); };
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <h2>POCSAG Receiver</h2>
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
        <button onClick={() => setPages([])} style={{ padding: "8px 16px", background: "#444", color: "#eee", border: "none", borderRadius: 4 }}>Clear</button>
        <span style={{ color: "#888", alignSelf: "center" }}>{pages.length} pages</span>
      </div>
      <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 200px)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#1c1c2c", textAlign: "left" }}>
              <th style={{ padding: "6px 8px" }}>RIC</th>
              <th style={{ padding: "6px 8px" }}>Function</th>
              <th style={{ padding: "6px 8px" }}>Message</th>
            </tr>
          </thead>
          <tbody>
            {pages.map((p, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #222" }}>
                <td style={{ padding: "4px 8px", fontFamily: "monospace" }}>{p.ric}</td>
                <td style={{ padding: "4px 8px" }}>{p.function}</td>
                <td style={{ padding: "4px 8px", fontFamily: "monospace", color: "#ccc", wordBreak: "break-all" }}>{p.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
