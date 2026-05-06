import { useState, useEffect } from "react";
import { useStore } from "../../store";
import { armTx, disarmTx, startApp } from "../../ipc/commands";
import { onTxStatus } from "../../ipc/events";
import { LegalBanner } from "../../components/LegalBanner";

export function MorseTxApp() {
  const { legalAccepted, armed, txStatus, setArmed, setTxStatus } = useStore();
  const [showLegal, setShowLegal] = useState(false);
  const [message, setMessage] = useState("");
  const [frequency, setFrequency] = useState("");
  const [wpm, setWpm] = useState(20);
  const [toneHz, setToneHz] = useState(700);
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
    await startApp("morse_tx" as any, {
      message,
      wpm,
      tone_hz: toneHz,
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
      <h2>Morse TX</h2>
      <p style={{ color: "#aaa", fontSize: 13 }}>CW Morse code transmitter — PARIS standard timing</p>

      <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 8, maxWidth: 500 }}>
        <label>Message</label>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} style={inputStyle} placeholder="Text to send in Morse..." />

        <label>Speed (WPM)</label>
        <div>
          <input type="range" min={5} max={60} value={wpm} onChange={(e) => setWpm(Number(e.target.value))} />
          <span style={{ marginLeft: 8 }}>{wpm} WPM</span>
        </div>

        <label>Tone (Hz)</label>
        <input type="number" value={toneHz} onChange={(e) => setToneHz(Number(e.target.value))} style={inputStyle} />

        <label>Frequency (Hz)</label>
        <input type="number" value={frequency} onChange={(e) => setFrequency(e.target.value)} placeholder="e.g. 7030000" style={inputStyle} />

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
