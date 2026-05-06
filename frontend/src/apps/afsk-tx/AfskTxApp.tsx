import { useState, useEffect } from "react";
import { useStore } from "../../store";
import { armTx, disarmTx, startApp } from "../../ipc/commands";
import { onTxStatus } from "../../ipc/events";
import { LegalBanner } from "../../components/LegalBanner";

export function AfskTxApp() {
  const { legalAccepted, armed, txStatus, setArmed, setTxStatus } = useStore();
  const [showLegal, setShowLegal] = useState(false);
  const [message, setMessage] = useState("");
  const [frequency, setFrequency] = useState("");
  const [markHz, setMarkHz] = useState(1200);
  const [spaceHz, setSpaceHz] = useState(2200);
  const [baud, setBaud] = useState(1200);
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
    await startApp("afsk_tx" as any, {
      message,
      mark_hz: markHz,
      space_hz: spaceHz,
      baud,
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
      <h2>AFSK Transmitter</h2>
      <p style={{ color: "#aaa", fontSize: 13 }}>Audio Frequency Shift Keying — configurable mark/space tones</p>

      <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 8, maxWidth: 500 }}>
        <label>Message</label>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} style={inputStyle} placeholder="Data to transmit..." />

        <label>Mark (Hz)</label>
        <input type="number" value={markHz} onChange={(e) => setMarkHz(Number(e.target.value))} style={inputStyle} />

        <label>Space (Hz)</label>
        <input type="number" value={spaceHz} onChange={(e) => setSpaceHz(Number(e.target.value))} style={inputStyle} />

        <label>Baud Rate</label>
        <select value={baud} onChange={(e) => setBaud(Number(e.target.value))} style={inputStyle}>
          <option value={300}>300</option>
          <option value={1200}>1200</option>
          <option value={2400}>2400</option>
          <option value={9600}>9600</option>
        </select>

        <label>Frequency (Hz)</label>
        <input type="number" value={frequency} onChange={(e) => setFrequency(e.target.value)} placeholder="e.g. 144800000" style={inputStyle} />

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
