import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp } from "../../ipc/commands";
import { LegalBanner } from "../../components/LegalBanner";
import { useStore } from "../../store";
import type { AppId } from "../../ipc/types/AppId";

interface TxStatus {
  kind: "idle" | "armed" | "transmitting" | "complete" | "error";
  progress_pct?: number;
  message?: string;
}

const inputStyle: React.CSSProperties = {
  background: "#222",
  color: "#eee",
  border: "1px solid #555",
  padding: "4px 8px",
};

const WARNING = (
  <div style={{ background: "#310", border: "1px solid #f44", borderRadius: 4, padding: "8px 12px", marginBottom: 12, color: "#f88", fontSize: 13 }}>
    <strong>INDOOR / SHIELDED TEST ONLY</strong> — transmissions span wide bandwidth.
    Operate only in a Faraday cage or RF-shielded enclosure.
  </div>
);

export function SpectrumPainterApp() {
  const { legalAccepted } = useStore();
  const [showLegal, setShowLegal] = useState(false);
  const [imagePath, setImagePath] = useState("");
  const [freqHz, setFreqHz] = useState(100_000_000);
  const [txStatus, setTxStatus] = useState<TxStatus | null>(null);

  useEffect(() => {
    const unlisten = listen<TxStatus>("tx_status", (e) => setTxStatus(e.payload));
    return () => { unlisten.then((f) => f()); };
  }, []);

  const handleTransmit = async () => {
    if (!legalAccepted) { setShowLegal(true); return; }
    await startApp("spectrum_painter" as AppId, {
      image_path: imagePath,
      center_hz: freqHz,
      vga_gain_db: 30,
      amp_enabled: false,
    });
  };

  return (
    <div style={{ padding: 16 }}>
      {showLegal && <LegalBanner onAccept={() => setShowLegal(false)} />}
      <h2>Spectrum Painter</h2>
      {WARNING}
      <p style={{ color: "#aaa", fontSize: 13 }}>
        Convert a grayscale image to IQ via IFFT and paint it on the waterfall display.
        Provide an 8-bit grayscale PNG; pixel intensity maps to spectral amplitude.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 8, maxWidth: 520, marginBottom: 16 }}>
        <label>Image Path:</label>
        <input
          type="text"
          value={imagePath}
          onChange={(e) => setImagePath(e.target.value)}
          placeholder="/path/to/image.png"
          style={inputStyle}
        />

        <label>Center Frequency (Hz):</label>
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
        PAINT
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
