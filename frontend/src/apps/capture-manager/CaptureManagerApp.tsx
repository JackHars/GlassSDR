import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import { LegalBanner } from "../../components/LegalBanner";
import { useStore } from "../../store";
import type { AppId } from "../../ipc/types/AppId";

interface TxStatus {
  kind: "idle" | "armed" | "transmitting" | "complete" | "error";
  progress_pct?: number;
  message?: string;
}

type Mode = "record" | "replay";

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

const WARNING = (
  <div style={{ background: "#220", border: "1px solid #fa0", borderRadius: 4, padding: "8px 12px", marginBottom: 12, color: "#fc8", fontSize: 13 }}>
    <strong>OWN DEVICES ONLY</strong> — only replay signals you are authorised to retransmit.
  </div>
);

export function CaptureManagerApp() {
  const { legalAccepted } = useStore();
  const [showLegal, setShowLegal] = useState(false);
  const [mode, setMode] = useState<Mode>("record");
  const [freqHz, setFreqHz] = useState(433_920_000);
  const [thresholdDb, setThresholdDb] = useState(-40);
  const [txStatus, setTxStatus] = useState<TxStatus | null>(null);

  useEffect(() => {
    const unlisten = listen<TxStatus>("tx_status", (e) => setTxStatus(e.payload));
    return () => { unlisten.then((f) => f()); };
  }, []);

  const handleAction = async (selectedMode: Mode) => {
    if (selectedMode === "replay" && !legalAccepted) { setShowLegal(true); return; }
    setMode(selectedMode);
    await startApp("capture_manager" as AppId, {
      mode: selectedMode,
      center_hz: freqHz,
      threshold_db: thresholdDb,
      lna_gain_db: 40,
      vga_gain_db: 20,
    });
  };

  return (
    <div style={{ padding: 16 }}>
      {showLegal && <LegalBanner onAccept={() => setShowLegal(false)} />}
      <h2>Capture Manager</h2>
      {WARNING}
      <p style={{ color: "#aaa", fontSize: 13 }}>
        Enhanced IQ recorder with trigger threshold and replay support.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 8, maxWidth: 480, marginBottom: 16 }}>
        <label>Frequency (Hz):</label>
        <input
          type="number"
          value={freqHz}
          onChange={(e) => setFreqHz(Number(e.target.value))}
          style={inputStyle}
        />

        <label>Trigger Threshold (dB):</label>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="range"
            min={-80}
            max={0}
            value={thresholdDb}
            onChange={(e) => setThresholdDb(Number(e.target.value))}
          />
          <span style={{ minWidth: 50 }}>{thresholdDb} dB</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={() => handleAction("record")} style={btnStyle("#2a6")}>Record</button>
        <button onClick={stopApp} style={btnStyle("#555")}>Stop</button>
        <button onClick={() => handleAction("replay")} style={btnStyle("#c50")}>Replay</button>
      </div>

      {txStatus && (
        <div style={{ padding: 8, background: "#222", borderRadius: 4 }}>
          Status: {txStatus.kind}
          {txStatus.progress_pct !== undefined ? ` (${txStatus.progress_pct}%)` : ""}
          {txStatus.message ? ` — ${txStatus.message}` : ""}
        </div>
      )}
    </div>
  );
}
