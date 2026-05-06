import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import type { AppId } from "../../ipc/types/AppId";

type TxStatus =
  | { kind: "idle" }
  | { kind: "armed" }
  | { kind: "transmitting"; progress_pct: number }
  | { kind: "complete" }
  | { kind: "error"; message: string };

const WAVEFORMS = ["sine", "square", "sawtooth", "triangle", "noise"];

export function SigGenApp() {
  const [freqHz, setFreqHz] = useState(100_000_000);
  const [waveform, setWaveform] = useState("sine");
  const [armed, setArmed] = useState(false);
  const [status, setStatus] = useState<TxStatus>({ kind: "idle" });

  const handleArm = () => {
    setArmed(true);
    startApp("sig_gen" as AppId, {
      center_hz: freqHz,
      waveform,
      vga_gain_db: 20,
      amp_enabled: false,
    });
  };

  const handleDisarm = () => {
    setArmed(false);
    stopApp();
  };

  useEffect(() => {
    const unlisten = listen<TxStatus>("pocsag_tx_status", (e) =>
      setStatus(e.payload)
    );
    return () => { unlisten.then((f) => f()); };
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <h2>Signal Generator</h2>
      <div
        style={{
          background: "#3a2a00",
          border: "1px solid #aa6600",
          borderRadius: 6,
          padding: "10px 14px",
          marginBottom: 16,
          color: "#ffbb44",
          fontSize: 13,
        }}
      >
        <strong>WARNING — IndoorTestOnly:</strong> Transmission is only permitted in a shielded
        environment or Faraday enclosure. Ensure compliance with local regulations before transmitting.
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
        <label>Waveform:</label>
        <select
          value={waveform}
          onChange={(e) => setWaveform(e.target.value)}
          style={{ padding: "4px 8px", background: "#222", color: "#eee", border: "1px solid #555" }}
        >
          {WAVEFORMS.map((w) => (
            <option key={w} value={w}>{w}</option>
          ))}
        </select>
        <label>Freq (Hz):</label>
        <input
          type="number"
          value={freqHz}
          onChange={(e) => setFreqHz(Number(e.target.value))}
          style={{ width: 140, padding: "4px 8px", background: "#222", color: "#eee", border: "1px solid #555" }}
        />
        {armed ? (
          <button onClick={handleDisarm} style={{ padding: "8px 16px", background: "#a22", color: "#fff", border: "none", borderRadius: 4 }}>
            Disarm
          </button>
        ) : (
          <button onClick={handleArm} style={{ padding: "8px 16px", background: "#2a2", color: "#fff", border: "none", borderRadius: 4 }}>
            Arm
          </button>
        )}
      </div>
      <div style={{ fontFamily: "monospace", color: "#aaa", fontSize: 13 }}>
        Status:{" "}
        {status.kind === "transmitting"
          ? `transmitting (${status.progress_pct}%)`
          : status.kind === "error"
          ? <span style={{ color: "#f66" }}>{status.message}</span>
          : status.kind}
      </div>
    </div>
  );
}
