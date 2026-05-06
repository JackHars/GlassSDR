import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";

interface PocsagPageEvent {
  ric: number;
  function: number;
  message: string;
}

interface AggPage {
  protocol: string;
  capcode: number;
  message: string;
}

export function PagerAggApp() {
  const [freq, setFreq] = useState("439987500");
  const [pages, setPages] = useState<AggPage[]>([]);

  const handleStart = () =>
    startApp("pager_aggregator" as AppId, { center_hz: parseFloat(freq), lna_gain_db: 32, vga_gain_db: 20, amp_enabled: false });

  useEffect(() => {
    const unlistenPocsag = listen<PocsagPageEvent>("pocsag_page", (e) => {
      const page: AggPage = { protocol: "POCSAG", capcode: e.payload.ric, message: e.payload.message };
      setPages((prev) => [page, ...prev].slice(0, 400));
    });
    return () => { unlistenPocsag.then((f) => f()); };
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <h2>Pager Aggregator</h2>
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
        <button onClick={() => setPages([])} style={{ padding: "8px 16px", background: "#444", color: "#eee", border: "none", borderRadius: 4 }}>Clear</button>
        <span style={{ color: "#888" }}>{pages.length} pages</span>
      </div>
      <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 160px)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#1c1c2c", textAlign: "left" }}>
              <th style={{ padding: "6px 8px" }}>Protocol</th>
              <th style={{ padding: "6px 8px" }}>RIC / Capcode</th>
              <th style={{ padding: "6px 8px" }}>Message</th>
            </tr>
          </thead>
          <tbody>
            {pages.map((p, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #222" }}>
                <td style={{ padding: "4px 8px", color: "#7bf" }}>{p.protocol}</td>
                <td style={{ padding: "4px 8px", fontFamily: "monospace" }}>{p.capcode}</td>
                <td style={{ padding: "4px 8px", fontFamily: "monospace", color: "#ccc", wordBreak: "break-all" }}>{p.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
