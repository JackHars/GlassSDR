import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";

interface OokDecodeEvent {
  protocol: string;
  code_hex: string;
}

export function OokDecodersApp() {
  const [decoded, setDecoded] = useState<OokDecodeEvent[]>([]);
  const [freqHz, setFreqHz] = useState(433_920_000);

  const handleStart = () =>
    startApp("ook_decoders" as AppId, {
      center_hz: freqHz,
      lna_gain_db: 40,
      vga_gain_db: 20,
      amp_enabled: false,
    });

  useEffect(() => {
    const unlisten = listen<OokDecodeEvent>("ook_decode", (e) =>
      setDecoded((prev) => [e.payload, ...prev].slice(0, 200))
    );
    return () => { unlisten.then((f) => f()); };
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <h2>OOK Decoders</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
        <label>Freq (Hz):</label>
        <input
          type="number"
          value={freqHz}
          onChange={(e) => setFreqHz(Number(e.target.value))}
          style={{ width: 140, padding: "4px 8px", background: "#222", color: "#eee", border: "1px solid #555" }}
        />
        <button onClick={handleStart} style={{ padding: "8px 16px", background: "#2a2", color: "#fff", border: "none", borderRadius: 4 }}>Start</button>
        <button onClick={stopApp} style={{ padding: "8px 16px", background: "#555", color: "#fff", border: "none", borderRadius: 4 }}>Stop</button>
        <button onClick={() => setDecoded([])} style={{ padding: "8px 16px", background: "#444", color: "#eee", border: "none", borderRadius: 4 }}>Clear</button>
        <span style={{ color: "#888" }}>{decoded.length} frames</span>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "#1c1c2c", textAlign: "left" }}>
            <th style={{ padding: "6px 8px" }}>Protocol</th>
            <th style={{ padding: "6px 8px" }}>Code (hex)</th>
          </tr>
        </thead>
        <tbody>
          {decoded.map((d, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #222" }}>
              <td style={{ padding: "4px 8px", color: "#8af" }}>{d.protocol}</td>
              <td style={{ padding: "4px 8px", fontFamily: "monospace" }}>{d.code_hex}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
