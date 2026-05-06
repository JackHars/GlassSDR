import { useState, useEffect } from "react";
import { startApp, stopApp } from "../../ipc/commands";
import { listen } from "@tauri-apps/api/event";

interface RdsData { pi: number; ps: string; rt: string; pty: number; }

export function RdsRxApp() {
  const [freq, setFreq] = useState("98100000");
  const [lna, setLna] = useState(24);
  const [vga, setVga] = useState(20);
  const [rds, setRds] = useState<RdsData | null>(null);

  useEffect(() => {
    const p = listen<RdsData>("rds_data", e => setRds(e.payload));
    return () => { p.then(fn => fn()); };
  }, []);

  const handleStart = () => startApp("rds_rx" as any, {
    center_hz: parseFloat(freq), lna_gain_db: lna, vga_gain_db: vga, amp_enabled: false, stereo: true,
  });

  return (
    <div style={{ padding: 16 }}>
      <h2>RDS Decoder</h2>
      <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8, maxWidth: 400 }}>
        <label>Frequency (Hz)</label>
        <input value={freq} onChange={e => setFreq(e.target.value)} style={{ background: "#222", color: "#eee", border: "1px solid #444", padding: 4 }} />
        <label>LNA Gain</label>
        <input type="range" min={0} max={40} step={8} value={lna} onChange={e => setLna(+e.target.value)} />
        <label>VGA Gain</label>
        <input type="range" min={0} max={62} step={2} value={vga} onChange={e => setVga(+e.target.value)} />
      </div>
      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <button onClick={handleStart} style={{ padding: "8px 16px", background: "#2a2", color: "#fff", border: "none", borderRadius: 4 }}>Start</button>
        <button onClick={stopApp} style={{ padding: "8px 16px", background: "#555", color: "#fff", border: "none", borderRadius: 4 }}>Stop</button>
      </div>
      {rds && (
        <div style={{ marginTop: 16, padding: 12, background: "#1a1a2e", borderRadius: 4 }}>
          <div><strong>Station:</strong> {rds.ps || "—"}</div>
          <div><strong>Radio Text:</strong> {rds.rt || "—"}</div>
          <div><strong>PI:</strong> {rds.pi.toString(16).toUpperCase()} | <strong>PTY:</strong> {rds.pty}</div>
        </div>
      )}
    </div>
  );
}
