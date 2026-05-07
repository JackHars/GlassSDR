import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp } from "../../ipc/commands";
import { LegalBanner } from "../../components/LegalBanner";
import { useStore } from "../../store";
import type { AppId } from "../../ipc/types/AppId";
import { RecordBar } from "../../components/RecordBar";
import { AppShell, ControlField, ControlRow } from "../../components/AppShell";

interface TxStatus {
  kind: "idle" | "armed" | "transmitting" | "complete" | "error";
  progress_pct?: number;
  message?: string;
}

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

  const handlePaint = async () => {
    if (!legalAccepted) { setShowLegal(true); return; }
    await startApp("spectrum_painter" as AppId, {
      image_path: imagePath, center_hz: freqHz, vga_gain_db: 30, amp_enabled: false,
    });
  };

  return (
    <AppShell
      title="Spectrum Painter"
      status={
        txStatus?.kind === "transmitting" ? <><span style={{color: "#FF3B30"}}>●</span> Painting{txStatus.progress_pct !== undefined ? ` ${txStatus.progress_pct}%` : ""}</>
        : <><span style={{color: "#999"}}>○</span> Idle · IFFT-based image transmitter</>
      }
      controls={
        <ControlRow
          actions={
            <button className="glass-btn" onClick={handlePaint} style={{ background: "#FF3B30", color: "#fff", fontWeight: 700 }}>PAINT</button>
          }
        >
          <ControlField label="Center Frequency (Hz)" size="lg">
            <input type="number" value={freqHz} onChange={(e) => setFreqHz(Number(e.target.value))} />
          </ControlField>
        </ControlRow>
      }
      footer={<RecordBar appId={"spectrum_painter" as any} format="iq" centerHz={freqHz} />}
    >
      {showLegal && <LegalBanner onAccept={() => setShowLegal(false)} />}
      <div className="app-shell__grow" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ padding: "12px 16px", background: "rgba(255,59,48,0.08)", border: "1px solid rgba(255,59,48,0.4)", borderRadius: 10, color: "#FF3B30", fontSize: 13 }}>
          <strong>INDOOR / SHIELDED TEST ONLY</strong> — transmissions span wide bandwidth.
          Operate only in a Faraday cage or RF-shielded enclosure.
        </div>
        <div style={{ flex: 1, padding: 16, background: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.7)", borderRadius: 12, backdropFilter: "blur(16px)", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            Convert a grayscale image to IQ via IFFT. Pixel intensity maps to spectral amplitude — the image
            appears on a waterfall display.
          </div>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 650, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--text-secondary)" }}>Image Path</span>
            <input type="text" value={imagePath} onChange={(e) => setImagePath(e.target.value)} placeholder="/path/to/image.png" />
          </label>
        </div>
        {txStatus && (
          <div style={{ padding: 12, background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 8, fontFamily: "var(--font-mono)", fontSize: 12 }}>
            Status: {txStatus.kind}{txStatus.progress_pct !== undefined ? ` · ${txStatus.progress_pct}%` : ""}{txStatus.message ? ` · ${txStatus.message}` : ""}
          </div>
        )}
      </div>
    </AppShell>
  );
}
