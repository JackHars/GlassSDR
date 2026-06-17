import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp } from "../../ipc/commands";
import { LegalBanner } from "../../components/LegalBanner";
import { useStore } from "../../store";
import type { AppId } from "../../ipc/types/AppId";
import { RecordBar } from "../../components/RecordBar";
import { AppScreen } from "../../components/kit/AppScreen";
import { Icon } from "../../components/kit/Icon";
import type { AppStatus } from "../../components/kit/AppScreen";

interface TxStatus { kind: "idle" | "armed" | "transmitting" | "complete" | "error"; progress_pct?: number; message?: string; }

export function SpectrumPainterApp() {
  const { legalAccepted } = useStore();
  const [showLegal, setShowLegal] = useState(false);
  const [imagePath, setImagePath] = useState("");
  const [freqHz, setFreqHz] = useState(100_000_000);
  const [txStatus, setTxStatus] = useState<TxStatus | null>(null);

  useEffect(() => {
    const p = listen<TxStatus>("tx_status", (e) => setTxStatus(e.payload));
    return () => { p.then((f) => f()); };
  }, []);

  const handlePaint = async () => {
    if (!legalAccepted) { setShowLegal(true); return; }
    await startApp("spectrum_painter" as AppId, { image_path: imagePath, center_hz: freqHz, vga_gain_db: 30, amp_enabled: false });
  };

  const isTransmitting = txStatus?.kind === "transmitting";
  const appStatus: AppStatus = isTransmitting ? "live" : "idle";

  return (
    <AppScreen
      appId="spectrum_painter"
      title="Spectrum Painter"
      subtitle="IFFT image transmitter"
      status={appStatus}
      statusText={isTransmitting ? `Painting ${txStatus?.progress_pct ?? 0}%` : "Ready"}
      controls={
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label className="app-shell__field-label">Center Frequency (Hz)</label>
            <input type="number" value={freqHz} style={{ width: 130 }} onChange={(e) => setFreqHz(+e.target.value)} />
          </div>
          <div style={{ marginLeft: "auto", alignSelf: "flex-end" }}>
            <button className="glass-btn" onClick={handlePaint} style={{ background: "var(--accent)", color: "#fff", fontWeight: 700 }}>PAINT</button>
          </div>
        </div>
      }
      footer={<RecordBar appId={"spectrum_painter" as Parameters<typeof RecordBar>[0]["appId"]} format="iq" centerHz={freqHz} />}
    >
      {showLegal && <LegalBanner onAccept={() => setShowLegal(false)} />}
      <div style={{ flex: "1 1 auto", display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}>
        <div style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: 8, background: "rgba(255,59,48,0.06)", border: "1px solid rgba(255,59,48,0.2)", borderRadius: 8, color: "#CC2010", fontSize: 12 }}>
          <Icon name="warning" size={16} /> INDOOR / SHIELDED ONLY — wide-bandwidth transmission. Use a Faraday cage or dummy load.
        </div>
        <div style={{ flex: 1, padding: 16, background: "rgba(255,255,255,0.55)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.7)", borderRadius: 12, display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>
            Convert a grayscale image to RF via IFFT — pixel intensity maps to spectral amplitude, producing a visible image on a waterfall receiver.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label className="app-shell__field-label">Image Path</label>
            <input type="text" value={imagePath} onChange={(e) => setImagePath(e.target.value)} placeholder="/path/to/image.png" />
          </div>
          {txStatus && (
            <div style={{ padding: "8px 12px", background: "rgba(0,0,0,0.04)", borderRadius: 8, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-secondary)" }}>
              {txStatus.kind}{txStatus.progress_pct !== undefined ? ` · ${txStatus.progress_pct}%` : ""}{txStatus.message ? ` · ${txStatus.message}` : ""}
            </div>
          )}
        </div>
      </div>
    </AppScreen>
  );
}
