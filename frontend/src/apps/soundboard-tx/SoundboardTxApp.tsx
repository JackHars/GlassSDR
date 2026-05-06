import { useState, useEffect } from "react";
import { useStore } from "../../store";
import { armTx, disarmTx, startApp } from "../../ipc/commands";
import { onTxStatus } from "../../ipc/events";
import { LegalBanner } from "../../components/LegalBanner";

const CLIPS = [
  { id: "default", label: "Test Tone (1 kHz)" },
  { id: "roger_beep", label: "Roger Beep" },
  { id: "cq_cq", label: "CQ CQ DE" },
];

export function SoundboardTxApp() {
  const { legalAccepted, armed, txStatus, setArmed, setTxStatus } = useStore();
  const [showLegal, setShowLegal] = useState(false);
  const [clipId, setClipId] = useState("default");
  const [frequency, setFrequency] = useState("");
  const [vgaGain, setVgaGain] = useState(20);
  const [ampEnabled, setAmpEnabled] = useState(false);

  useEffect(() => {
    const p = onTxStatus((status) => setTxStatus(status));
    return () => { p.then((fn) => fn()); };
  }, [setTxStatus]);

  const handleArm = async () => {
    if (!legalAccepted) { setShowLegal(true); return; }
    await armTx();
    setArmed(true);
  };

  const handleDisarm = async () => {
    await disarmTx();
    setArmed(false);
  };

  const handleTransmit = async () => {
    if (!armed) return;
    await startApp("soundboard_tx" as any, {
      clip_id: clipId,
      center_hz: parseFloat(frequency) || 0,
      vga_gain_db: vgaGain,
      amp_enabled: ampEnabled,
    });
    setArmed(false);
  };

  const inputStyle = { background: "#222", color: "#eee", border: "1px solid #444", padding: 4 };

  return (
    <div style={{ padding: 16 }}>
      {showLegal && <LegalBanner onAccept={() => setShowLegal(false)} />}
      <h2>Soundboard TX</h2>
      <p style={{ color: "#aaa", fontSize: 13 }}>Transmit pre-recorded audio clips via FM</p>

      <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 8, maxWidth: 500 }}>
        <label>Clip</label>
        <select value={clipId} onChange={(e) => setClipId(e.target.value)} style={inputStyle}>
          {CLIPS.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>

        <label>Frequency (Hz)</label>
        <input type="number" value={frequency} onChange={(e) => setFrequency(e.target.value)} placeholder="e.g. 146520000" style={inputStyle} />

        <label>TX VGA Gain</label>
        <div>
          <input type="range" min={0} max={47} value={vgaGain} onChange={(e) => setVgaGain(Number(e.target.value))} />
          <span style={{ marginLeft: 8 }}>{vgaGain} dB</span>
        </div>

        <label>AMP</label>
        <input type="checkbox" checked={ampEnabled} onChange={(e) => setAmpEnabled(e.target.checked)} />
      </div>

      <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
        {!armed ? (
          <button onClick={handleArm} style={{ padding: "8px 16px", background: "#c50", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>ARM TX</button>
        ) : (
          <>
            <button onClick={handleDisarm} style={{ padding: "8px 16px", background: "#555", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>DISARM</button>
            <button onClick={handleTransmit} style={{ padding: "8px 16px", background: "#f44", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: "bold" }}>TRANSMIT</button>
          </>
        )}
      </div>

      {txStatus && (
        <div style={{ marginTop: 12, padding: 8, background: "#222", borderRadius: 4 }}>
          Status: {txStatus.kind}{txStatus.progress_pct !== undefined ? ` (${txStatus.progress_pct}%)` : ""}{txStatus.message ? ` — ${txStatus.message}` : ""}
        </div>
      )}
    </div>
  );
}
