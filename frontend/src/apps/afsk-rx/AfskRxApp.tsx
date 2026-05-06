import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";

interface AfskBitEvent {
  hex_dump: string;
  decoded_ascii: string;
}

export function AfskRxApp() {
  const [freq, setFreq] = useState("144800000");
  const [markHz, setMarkHz] = useState("1200");
  const [spaceHz, setSpaceHz] = useState("2200");
  const [baud, setBaud] = useState("1200");
  const [frames, setFrames] = useState<AfskBitEvent[]>([]);

  const handleStart = () =>
    startApp("afsk_rx" as AppId, {
      center_hz: parseFloat(freq),
      mark_hz: parseFloat(markHz),
      space_hz: parseFloat(spaceHz),
      baud_rate: parseFloat(baud),
      lna_gain_db: 32,
      vga_gain_db: 20,
      amp_enabled: false,
    });

  useEffect(() => {
    const unlisten = listen<AfskBitEvent>("afsk_bits", (e) =>
      setFrames((prev) => [e.payload, ...prev].slice(0, 100))
    );
    return () => { unlisten.then((f) => f()); };
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <h2>AFSK Receiver</h2>
      <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8, maxWidth: 400, marginBottom: 12 }}>
        <label>Frequency (Hz)</label>
        <input value={freq} onChange={(e) => setFreq(e.target.value)} style={{ background: "#222", color: "#eee", border: "1px solid #444", padding: 4 }} />
        <label>Mark (Hz)</label>
        <input value={markHz} onChange={(e) => setMarkHz(e.target.value)} style={{ background: "#222", color: "#eee", border: "1px solid #444", padding: 4 }} />
        <label>Space (Hz)</label>
        <input value={spaceHz} onChange={(e) => setSpaceHz(e.target.value)} style={{ background: "#222", color: "#eee", border: "1px solid #444", padding: 4 }} />
        <label>Baud</label>
        <input value={baud} onChange={(e) => setBaud(e.target.value)} style={{ background: "#222", color: "#eee", border: "1px solid #444", padding: 4 }} />
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={handleStart} style={{ padding: "8px 16px", background: "#2a2", color: "#fff", border: "none", borderRadius: 4 }}>Start</button>
        <button onClick={stopApp} style={{ padding: "8px 16px", background: "#555", color: "#fff", border: "none", borderRadius: 4 }}>Stop</button>
        <button onClick={() => setFrames([])} style={{ padding: "8px 16px", background: "#444", color: "#eee", border: "none", borderRadius: 4 }}>Clear</button>
        <span style={{ color: "#888", alignSelf: "center" }}>{frames.length} frames</span>
      </div>
      <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 280px)" }}>
        {frames.map((f, i) => (
          <div key={i} style={{ marginBottom: 8, background: "#1a1a2a", padding: 8, borderRadius: 4 }}>
            <div style={{ fontFamily: "monospace", fontSize: 12, color: "#7af", wordBreak: "break-all" }}>{f.hex_dump}</div>
            {f.decoded_ascii && (
              <div style={{ fontFamily: "monospace", fontSize: 12, color: "#aaa", marginTop: 4, wordBreak: "break-all" }}>{f.decoded_ascii}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
