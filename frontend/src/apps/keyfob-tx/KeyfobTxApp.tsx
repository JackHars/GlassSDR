import { useState, useEffect } from "react";
import { useStore } from "../../store";
import { armTx, disarmTx, startApp } from "../../ipc/commands";
import { onTxStatus } from "../../ipc/events";
import { LegalBanner } from "../../components/LegalBanner";

const WARNING_BANNER = (
  <div style={{ background: "#220", border: "1px solid #fa0", borderRadius: 4, padding: "8px 12px", marginBottom: 12, color: "#fc8", fontSize: 13 }}>
    <strong>OWN DEVICES ONLY</strong> — Keyfob transmissions must only target devices you own and are licensed to operate.
  </div>
);

export function KeyfobTxApp() {
  const { legalAccepted, armed, txStatus, setArmed, setTxStatus } = useStore();
  const [showLegal, setShowLegal] = useState(false);
  const [frequency, setFrequency] = useState("433920000");
  const [code, setCode] = useState("0xABCDE");
  const [bits, setBits] = useState("24");
  const [repeats, setRepeats] = useState("3");
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
    await startApp("keyfob_tx" as any, {
      center_hz: parseFloat(frequency) || 433920000,
      code: parseInt(code, 16) || 0,
      bits: parseInt(bits) || 24,
      repeats: parseInt(repeats) || 3,
      vga_gain_db: vgaGain,
      amp_enabled: ampEnabled,
    });
    setArmed(false);
  };

  const inputStyle = { background: "#222", color: "#eee", border: "1px solid #444", padding: 4 };

  return (
    <div style={{ padding: 16 }}>
      {showLegal && <LegalBanner onAccept={() => setShowLegal(false)} />}
      <h2>Keyfob TX</h2>
      {WARNING_BANNER}
      <p style={{ color: "#aaa", fontSize: 13 }}>PT2262/EV1527 fixed-code keyfob encoder — 315/433 MHz ISM band</p>

      <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 8, maxWidth: 500 }}>
        <label>Frequency (Hz)</label>
        <input type="number" value={frequency} onChange={(e) => setFrequency(e.target.value)} placeholder="e.g. 433920000" style={inputStyle} />

        <label>Code (hex)</label>
        <input type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. 0xABCDE" style={inputStyle} />

        <label>Bits</label>
        <input type="number" value={bits} onChange={(e) => setBits(e.target.value)} min={1} max={32} style={inputStyle} />

        <label>Repeats</label>
        <input type="number" value={repeats} onChange={(e) => setRepeats(e.target.value)} min={1} max={10} style={inputStyle} />

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
