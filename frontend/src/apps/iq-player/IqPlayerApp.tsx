import { useState } from "react";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";

const inp: React.CSSProperties = {
  background: "#222", color: "#eee", border: "1px solid #555",
  borderRadius: 3, padding: "4px 8px",
};

type IqFormat = "cs8" | "cu8" | "cs16" | "cf32";

export function IqPlayerApp() {
  const [filePath, setFilePath] = useState("");
  const [format, setFormat] = useState<IqFormat>("cs8");
  const [centerHz, setCenterHz] = useState(100_000_000);
  const [playing, setPlaying] = useState(false);

  const play = () => {
    if (!filePath.trim()) return;
    startApp("iq_player" as AppId, { file_path: filePath, format, center_hz: centerHz });
    setPlaying(true);
  };
  const stop = () => { stopApp(); setPlaying(false); };

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>IQ File Player</h2>
      <p style={{ color: "#aaa", fontSize: 13 }}>
        Load and replay a recorded IQ file for offline analysis.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 8, maxWidth: 480, marginBottom: 16 }}>
        <label>File Path:</label>
        <input
          type="text"
          value={filePath}
          onChange={(e) => setFilePath(e.target.value)}
          placeholder="/path/to/recording.cs8"
          style={{ ...inp, width: "100%" }}
        />
        <label>IQ Format:</label>
        <select value={format} onChange={(e) => setFormat(e.target.value as IqFormat)}
          style={{ ...inp, width: "auto" }}>
          <option value="cs8">CS8 (int8, HackRF default)</option>
          <option value="cu8">CU8 (uint8, RTL-SDR)</option>
          <option value="cs16">CS16 (int16)</option>
          <option value="cf32">CF32 (float32)</option>
        </select>
        <label>Center Freq (Hz):</label>
        <input type="number" value={centerHz} onChange={(e) => setCenterHz(Number(e.target.value))} style={inp} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={play} disabled={playing || !filePath.trim()}
          style={{ padding: "7px 16px", background: "#262", color: "#eee", border: "none", borderRadius: 3, cursor: "pointer" }}>
          Play
        </button>
        <button onClick={stop} disabled={!playing}
          style={{ padding: "7px 16px", background: "#622", color: "#eee", border: "none", borderRadius: 3, cursor: "pointer" }}>
          Stop
        </button>
      </div>
      {playing && (
        <div style={{ marginTop: 12, color: "#8cf", fontSize: 13 }}>
          Playing: <code style={{ color: "#fc8" }}>{filePath}</code>
        </div>
      )}
    </div>
  );
}
