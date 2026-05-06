import { useState } from "react";
import { startApp, stopApp } from "../../ipc/commands";

export function CwRxApp() {
  const [freq, setFreq] = useState("7030000");
  const [lna, setLna] = useState(24);
  const [vga, setVga] = useState(20);
  const [pitch, setPitch] = useState(600);

  const handleStart = () => startApp("cw_rx" as any, {
    center_hz: parseFloat(freq), lna_gain_db: lna, vga_gain_db: vga, amp_enabled: false, bfo_hz: pitch, bandwidth_hz: 400, sideband: "upper",
  });

  return (
    <div style={{ padding: 16 }}>
      <h2>CW Receiver</h2>
      <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8, maxWidth: 400 }}>
        <label>Frequency (Hz)</label>
        <input value={freq} onChange={e => setFreq(e.target.value)} style={{ background: "#222", color: "#eee", border: "1px solid #444", padding: 4 }} />
        <label>LNA Gain</label>
        <input type="range" min={0} max={40} step={8} value={lna} onChange={e => setLna(+e.target.value)} />
        <label>VGA Gain</label>
        <input type="range" min={0} max={62} step={2} value={vga} onChange={e => setVga(+e.target.value)} />
        <label>Pitch (Hz)</label>
        <input type="range" min={300} max={1000} value={pitch} onChange={e => setPitch(+e.target.value)} />
      </div>
      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <button onClick={handleStart} style={{ padding: "8px 16px", background: "#2a2", color: "#fff", border: "none", borderRadius: 4 }}>Start</button>
        <button onClick={stopApp} style={{ padding: "8px 16px", background: "#555", color: "#fff", border: "none", borderRadius: 4 }}>Stop</button>
      </div>
    </div>
  );
}
