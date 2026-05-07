import { useState } from "react";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";
import { RecordBar } from "../../components/RecordBar";
import { AppShell, ControlField, ControlRow } from "../../components/AppShell";

type IqFormat = "cs8" | "cu8" | "cs16" | "cf32";

export function IqPlayerApp() {
  const [filePath, setFilePath] = useState("");
  const [format, setFormat] = useState<IqFormat>("cs8");
  const [centerHz, setCenterHz] = useState(100_000_000);
  const [playing, setPlaying] = useState(false);

  const play = async () => {
    if (!filePath.trim()) return;
    await startApp("iq_player" as AppId, { file_path: filePath, format, center_hz: centerHz });
    setPlaying(true);
  };
  const stop = async () => { await stopApp(); setPlaying(false); };

  return (
    <AppShell
      title="IQ File Player"
      status={playing ? <><span style={{color: "#34C759"}}>●</span> Playing · {format.toUpperCase()}</> : <><span style={{color: "#999"}}>○</span> Idle</>}
      controls={
        <ControlRow
          actions={
            <>
              <button className="glass-btn primary" onClick={play} disabled={playing || !filePath.trim()}>Play</button>
              <button className="glass-btn" onClick={stop} disabled={!playing}>Stop</button>
            </>
          }
        >
          <ControlField label="IQ Format" size="md">
            <select value={format} onChange={(e) => setFormat(e.target.value as IqFormat)}>
              <option value="cs8">CS8 (HackRF)</option>
              <option value="cu8">CU8 (RTL-SDR)</option>
              <option value="cs16">CS16</option>
              <option value="cf32">CF32</option>
            </select>
          </ControlField>
          <ControlField label="Center Frequency (Hz)" size="lg">
            <input type="number" value={centerHz} onChange={(e) => setCenterHz(Number(e.target.value))} />
          </ControlField>
        </ControlRow>
      }
      footer={<RecordBar appId={"iq_player" as any} format="iq" centerHz={centerHz} />}
    >
      <div className="app-shell__grow" style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
        <div style={{ flex: 1, padding: 16, background: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.7)", borderRadius: 12, backdropFilter: "blur(16px)", display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 650, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--text-secondary)" }}>File Path</span>
            <input type="text" value={filePath} onChange={(e) => setFilePath(e.target.value)} placeholder="/path/to/recording.cs8" />
          </label>
          {playing && (
            <div style={{ marginTop: 12, color: "var(--accent)", fontSize: 13 }}>
              Playing: <code style={{ color: "var(--text-primary)" }}>{filePath}</code>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
