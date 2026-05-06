import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp } from "../../ipc/commands";
import { LegalBanner } from "../../components/LegalBanner";
import type { AppId } from "../../ipc/types/AppId";
import { useStore } from "../../store";

interface TxStatus {
  kind: "idle" | "armed" | "transmitting" | "complete" | "error";
  progress_pct?: number;
  message?: string;
}

const PROTOCOLS = ["pt2262", "ev1527", "hcs300", "keeloq", "came", "nice"] as const;

const inputStyle: React.CSSProperties = {
  background: "#222",
  color: "#eee",
  border: "1px solid #555",
  padding: "4px 8px",
};

const WARNING = (
  <div style={{ background: "#220", border: "1px solid #fa0", borderRadius: 4, padding: "8px 12px", marginBottom: 12, color: "#fc8", fontSize: 13 }}>
    <strong>OWN DEVICES ONLY</strong> — only transmit OOK codes to devices you own.
  </div>
);

export function EncoderSuiteApp() {
  const { legalAccepted } = useStore();
  const [showLegal, setShowLegal] = useState(false);
  const [protocol, setProtocol] = useState<string>("pt2262");
  const [code, setCode] = useState("000000000000");
  const [freqHz, setFreqHz] = useState(433_920_000);
  const [txStatus, setTxStatus] = useState<TxStatus | null>(null);

  useEffect(() => {
    const unlisten = listen<TxStatus>("tx_status", (e) => setTxStatus(e.payload));
    return () => { unlisten.then((f) => f()); };
  }, []);

  const handleTransmit = async () => {
    if (!legalAccepted) { setShowLegal(true); return; }
    await startApp("encoder_suite" as AppId, {
      protocol,
      code,
      center_hz: freqHz,
      vga_gain_db: 30,
      amp_enabled: false,
    });
  };

  return (
    <div style={{ padding: 16 }}>
      {showLegal && <LegalBanner onAccept={() => setShowLegal(false)} />}
      <h2>Encoder Suite</h2>
      {WARNING}
      <p style={{ color: "#aaa", fontSize: 13 }}>
        Multi-protocol OOK encoder — PT2262, EV1527, HCS300 and more.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 8, maxWidth: 500, marginBottom: 16 }}>
        <label>Protocol:</label>
        <select
          value={protocol}
          onChange={(e) => setProtocol(e.target.value)}
          style={inputStyle}
        >
          {PROTOCOLS.map((p) => (
            <option key={p} value={p}>{p.toUpperCase()}</option>
          ))}
        </select>

        <label>Code:</label>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Bit pattern or hex code"
          style={inputStyle}
        />

        <label>Frequency (Hz):</label>
        <input
          type="number"
          value={freqHz}
          onChange={(e) => setFreqHz(Number(e.target.value))}
          style={inputStyle}
        />
      </div>

      <button
        onClick={handleTransmit}
        style={{ padding: "8px 24px", background: "#c50", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: "bold" }}
      >
        TRANSMIT
      </button>

      {txStatus && (
        <div style={{ marginTop: 12, padding: 8, background: "#222", borderRadius: 4 }}>
          Status: {txStatus.kind}
          {txStatus.progress_pct !== undefined ? ` (${txStatus.progress_pct}%)` : ""}
          {txStatus.message ? ` — ${txStatus.message}` : ""}
        </div>
      )}
    </div>
  );
}
