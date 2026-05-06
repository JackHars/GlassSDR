import { useState, useEffect } from "react";
import { useStore } from "../../store";
import { armTx, disarmTx, startApp } from "../../ipc/commands";
import { onPocsagTxStatus } from "../../ipc/events";
import { LegalBanner } from "../../components/LegalBanner";

export function PocsagTxApp() {
  const { legalAccepted, armed, txStatus, setArmed, setTxStatus } = useStore();
  const [showLegal, setShowLegal] = useState(false);
  const [ric, setRic] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"numeric" | "alphanumeric" | "tone_only">("alphanumeric");
  const [baudRate, setBaudRate] = useState<number>(1200);
  const [frequency, setFrequency] = useState("");
  const [vgaGain, setVgaGain] = useState(20);
  const [ampEnabled, setAmpEnabled] = useState(false);
  const [funcBits, setFuncBits] = useState(0);

  useEffect(() => {
    const p = onPocsagTxStatus((status) => setTxStatus(status));
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
    await startApp("pocsag_tx" as any, {
      ric: parseInt(ric, 10) || 0,
      function: funcBits,
      message,
      message_type: messageType,
      baud_rate: baudRate,
      center_hz: parseFloat(frequency) || 0,
      vga_gain_db: vgaGain,
      amp_enabled: ampEnabled,
    });
    setArmed(false);
  };

  return (
    <div style={{ padding: 16 }}>
      {showLegal && <LegalBanner onAccept={() => setShowLegal(false)} />}
      <h2>POCSAG Transmitter</h2>

      <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 8, maxWidth: 500 }}>
        <label>RIC</label>
        <input type="number" value={ric} onChange={(e) => setRic(e.target.value)} placeholder="0–2097151" style={{ background: "#222", color: "#eee", border: "1px solid #444", padding: 4 }} />

        <label>Function</label>
        <select value={funcBits} onChange={(e) => setFuncBits(Number(e.target.value))} style={{ background: "#222", color: "#eee", border: "1px solid #444", padding: 4 }}>
          <option value={0}>A (0)</option>
          <option value={1}>B (1)</option>
          <option value={2}>C (2)</option>
          <option value={3}>D (3)</option>
        </select>

        <label>Message Type</label>
        <select value={messageType} onChange={(e) => setMessageType(e.target.value as any)} style={{ background: "#222", color: "#eee", border: "1px solid #444", padding: 4 }}>
          <option value="alphanumeric">Alphanumeric</option>
          <option value="numeric">Numeric</option>
          <option value="tone_only">Tone Only</option>
        </select>

        <label>Message</label>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} disabled={messageType === "tone_only"} rows={3} style={{ background: "#222", color: "#eee", border: "1px solid #444", padding: 4 }} />

        <label>Baud Rate</label>
        <select value={baudRate} onChange={(e) => setBaudRate(Number(e.target.value))} style={{ background: "#222", color: "#eee", border: "1px solid #444", padding: 4 }}>
          <option value={512}>512 bps</option>
          <option value={1200}>1200 bps</option>
          <option value={2400}>2400 bps</option>
        </select>

        <label>Frequency (Hz)</label>
        <input type="number" value={frequency} onChange={(e) => setFrequency(e.target.value)} placeholder="e.g. 439987500" style={{ background: "#222", color: "#eee", border: "1px solid #444", padding: 4 }} />

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
