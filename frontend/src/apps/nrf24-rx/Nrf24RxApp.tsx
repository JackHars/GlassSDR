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

export function Nrf24RxApp() {
  const [packets, setPackets] = useState<OokDecodeEvent[]>([]);
  const [channel, setChannel] = useState(76);
  const [address, setAddress] = useState("E7E7E7E7E7");

  const handleStart = () =>
    startApp("nrf24_rx" as AppId, {
      channel,
      address,
      lna_gain_db: 40,
      vga_gain_db: 20,
      amp_enabled: false,
    });

  useEffect(() => {
    const unlisten = listen<OokDecodeEvent>("ook_decode", (e) =>
      setPackets((prev) => [e.payload, ...prev].slice(0, 300))
    );
    return () => { unlisten.then((f) => f()); };
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <h2>NRF24 Sniffer</h2>
      <p style={{ color: "#aaa", fontSize: 13 }}>
        Passive nRF24L01+ Enhanced ShockBurst packet sniffer.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8, maxWidth: 440, marginBottom: 12 }}>
        <label>Channel (0–125):</label>
        <input
          type="number"
          min={0}
          max={125}
          value={channel}
          onChange={(e) => setChannel(Number(e.target.value))}
          style={inputStyle}
        />
        <label>Address (hex):</label>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="E7E7E7E7E7"
          style={inputStyle}
        />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={handleStart} style={btnStyle("#2a6")}>Start</button>
        <button onClick={stopApp} style={btnStyle("#555")}>Stop</button>
        <button onClick={() => setPackets([])} style={btnStyle("#444")}>Clear</button>
        <span style={{ color: "#888" }}>{packets.length} packets</span>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "#1c1c2c", textAlign: "left" }}>
            <th style={{ padding: "6px 8px" }}>Protocol</th>
            <th style={{ padding: "6px 8px" }}>Payload (hex)</th>
          </tr>
        </thead>
        <tbody>
          {packets.map((p, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #222" }}>
              <td style={{ padding: "4px 8px", color: "#8af" }}>{p.protocol}</td>
              <td style={{ padding: "4px 8px", fontFamily: "monospace" }}>{p.code_hex}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
