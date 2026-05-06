import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";

interface OokDecodeEvent {
  protocol: string;
  code_hex: string;
}

const inputStyle: React.CSSProperties = {
  background: "#222",
  color: "#eee",
  border: "1px solid #555",
  padding: "4px 8px",
};

const btnStyle = (color: string): React.CSSProperties => ({
  padding: "8px 16px",
  background: color,
  color: "#fff",
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
});

export function DecoderSuiteApp() {
  const [decoded, setDecoded] = useState<OokDecodeEvent[]>([]);
  const [freqHz, setFreqHz] = useState(433_920_000);

  const handleStart = () =>
    startApp("decoder_suite" as AppId, {
      center_hz: freqHz,
      lna_gain_db: 40,
      vga_gain_db: 20,
      amp_enabled: false,
    });

  useEffect(() => {
    const unlisten = listen<OokDecodeEvent>("ook_decode", (e) =>
      setDecoded((prev) => [e.payload, ...prev].slice(0, 300))
    );
    return () => { unlisten.then((f) => f()); };
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <h2>Decoder Suite</h2>
      <p style={{ color: "#aaa", fontSize: 13 }}>
        Passive multi-protocol OOK receiver — PT2262, EV1527, TPMS, weather sensors and more.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
        <label>Freq (Hz):</label>
        <input
          type="number"
          value={freqHz}
          onChange={(e) => setFreqHz(Number(e.target.value))}
          style={{ ...inputStyle, width: 160 }}
        />
        <button onClick={handleStart} style={btnStyle("#2a6")}>Start</button>
        <button onClick={stopApp} style={btnStyle("#555")}>Stop</button>
        <button onClick={() => setDecoded([])} style={btnStyle("#444")}>Clear</button>
        <span style={{ color: "#888" }}>{decoded.length} decoded</span>
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
