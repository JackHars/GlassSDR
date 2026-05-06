import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";

interface BleAdvEvent {
  mac: string;
  rssi_db: number;
  adv_type: string;
  data_hex: string;
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

export function BtleRxApp() {
  const [adverts, setAdverts] = useState<BleAdvEvent[]>([]);
  const [channel, setChannel] = useState(37);

  const handleStart = () =>
    startApp("btle_rx" as AppId, {
      channel,
      lna_gain_db: 40,
      vga_gain_db: 20,
      amp_enabled: false,
    });

  useEffect(() => {
    const unlisten = listen<BleAdvEvent>("ble_adv", (e) =>
      setAdverts((prev) => [e.payload, ...prev].slice(0, 500))
    );
    return () => { unlisten.then((f) => f()); };
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <h2>BTLE RX</h2>
      <p style={{ color: "#aaa", fontSize: 13 }}>
        Passive BLE advertisement sniffer — advertising channels 37 / 38 / 39.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
        <label>Channel:</label>
        <select
          value={channel}
          onChange={(e) => setChannel(Number(e.target.value))}
          style={{ ...inputStyle, width: 80 }}
        >
          <option value={37}>37</option>
          <option value={38}>38</option>
          <option value={39}>39</option>
        </select>
        <button onClick={handleStart} style={btnStyle("#2a6")}>Start</button>
        <button onClick={stopApp} style={btnStyle("#555")}>Stop</button>
        <button onClick={() => setAdverts([])} style={btnStyle("#444")}>Clear</button>
        <span style={{ color: "#888" }}>{adverts.length} packets</span>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "#1c1c2c", textAlign: "left" }}>
            <th style={{ padding: "6px 8px" }}>MAC</th>
            <th style={{ padding: "6px 8px" }}>RSSI (dB)</th>
            <th style={{ padding: "6px 8px" }}>Type</th>
            <th style={{ padding: "6px 8px" }}>Data</th>
          </tr>
        </thead>
        <tbody>
          {adverts.map((a, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #222" }}>
              <td style={{ padding: "4px 8px", color: "#8af", fontFamily: "monospace" }}>{a.mac}</td>
              <td style={{ padding: "4px 8px" }}>{a.rssi_db.toFixed(1)}</td>
              <td style={{ padding: "4px 8px", color: "#fa8" }}>{a.adv_type}</td>
              <td style={{ padding: "4px 8px", fontFamily: "monospace", fontSize: 11 }}>{a.data_hex}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
