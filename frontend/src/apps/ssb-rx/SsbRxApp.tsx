import { useState } from "react";
import { startApp, stopApp } from "../../ipc/commands";

export function SsbRxApp({ appId, label }: { appId: string; label: string }) {
  const [freq, setFreq] = useState("14200000");
  const [lna, setLna] = useState(24);
  const [vga, setVga] = useState(20);
  const [bfo, setBfo] = useState(1500);
  const [bw, setBw] = useState(2700);

  const sideband = appId === "usb_rx" ? "upper" : "lower";
  const handleStart = () => startApp(appId as any, {
    center_hz: parseFloat(freq), lna_gain_db: lna, vga_gain_db: vga, amp_enabled: false, bfo_hz: bfo, bandwidth_hz: bw, sideband,
  });

  return (
    <div style={{ padding: 16 }}>
      <h2>{label}</h2>
      <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8, maxWidth: 400 }}>
        <label>Frequency (Hz)</label>
        <input value={freq} onChange={e => setFreq(e.target.value)} style={{ background: "#222", color: "#eee", border: "1px solid #444", padding: 4 }} />
        <label>LNA Gain</label>
        <input type="range" min={0} max={40} step={8} value={lna} onChange={e => setLna(+e.target.value)} />
        <label>VGA Gain</label>
        <input type="range" min={0} max={62} step={2} value={vga} onChange={e => setVga(+e.target.value)} />
        <label>BFO (Hz)</label>
        <input type="number" value={bfo} onChange={e => setBfo(+e.target.value)} style={{ background: "#222", color: "#eee", border: "1px solid #444", padding: 4 }} />
        <label>Bandwidth</label>
        <input type="number" value={bw} onChange={e => setBw(+e.target.value)} style={{ background: "#222", color: "#eee", border: "1px solid #444", padding: 4 }} />
      </div>
      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <button onClick={handleStart} style={{ padding: "8px 16px", background: "#2a2", color: "#fff", border: "none", borderRadius: 4 }}>Start</button>
        <button onClick={stopApp} style={{ padding: "8px 16px", background: "#555", color: "#fff", border: "none", borderRadius: 4 }}>Stop</button>
      </div>
    </div>
  );
}
