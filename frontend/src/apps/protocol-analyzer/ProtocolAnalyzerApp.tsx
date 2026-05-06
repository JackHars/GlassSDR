import { useState } from "react";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";

const inp: React.CSSProperties = {
  background: "#222", color: "#eee", border: "1px solid #555",
  borderRadius: 3, padding: "4px 8px", width: 140,
};

export function ProtocolAnalyzerApp() {
  const [freqHz, setFreqHz] = useState(433_920_000);
  const [symbolRate, setSymbolRate] = useState(9600);
  const [running, setRunning] = useState(false);

  const start = () => {
    startApp("protocol_analyzer" as AppId, { center_hz: freqHz, symbol_rate: symbolRate });
    setRunning(true);
  };
  const stop = () => { stopApp(); setRunning(false); };

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>Protocol Analyzer</h2>
      <p style={{ color: "#aaa", fontSize: 13 }}>
        Passive capture with eye diagram visualization for digital signal analysis.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 8, maxWidth: 420, marginBottom: 16 }}>
        <label>Frequency (Hz):</label>
        <input type="number" value={freqHz} onChange={(e) => setFreqHz(Number(e.target.value))} style={inp} />
        <label>Symbol Rate (bps):</label>
        <input type="number" value={symbolRate} onChange={(e) => setSymbolRate(Number(e.target.value))} style={inp} />
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={start} disabled={running}
          style={{ padding: "7px 16px", background: "#262", color: "#eee", border: "none", borderRadius: 3, cursor: "pointer" }}>
          Capture
        </button>
        <button onClick={stop} disabled={!running}
          style={{ padding: "7px 16px", background: "#622", color: "#eee", border: "none", borderRadius: 3, cursor: "pointer" }}>
          Stop
        </button>
      </div>
      <div style={{
        width: 480, height: 240, background: "#0a0a16", border: "1px solid #334",
        borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ color: "#445", fontSize: 13 }}>Eye diagram — capture a signal to populate</span>
      </div>
    </div>
  );
}
