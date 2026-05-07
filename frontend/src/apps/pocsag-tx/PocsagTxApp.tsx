import { useState, useEffect } from "react";
import { useStore } from "../../store";
import { armTx, disarmTx, startApp } from "../../ipc/commands";
import { onPocsagTxStatus } from "../../ipc/events";
import { LegalBanner } from "../../components/LegalBanner";
import { RecordBar } from "../../components/RecordBar";
import { AppShell, ControlField, ControlRow } from "../../components/AppShell";

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
    <AppShell
      title="POCSAG Transmitter"
      status={
        armed
          ? <><span style={{color: "#FF9500"}}>●</span> Armed — ready to transmit</>
          : txStatus?.kind === "transmitting"
            ? <><span style={{color: "#FF3B30"}}>●</span> Transmitting{txStatus.progress_pct !== undefined ? ` ${txStatus.progress_pct}%` : ""}</>
            : <><span style={{color: "#999"}}>○</span> Idle</>
      }
      controls={
        <ControlRow
          actions={
            !armed ? (
              <button className="glass-btn" onClick={handleArm} style={{ background: "#FF9500", color: "#fff" }}>ARM TX</button>
            ) : (
              <>
                <button className="glass-btn" onClick={handleDisarm}>Disarm</button>
                <button className="glass-btn" onClick={handleTransmit} style={{ background: "#FF3B30", color: "#fff", fontWeight: 700 }}>TRANSMIT</button>
              </>
            )
          }
        >
          <ControlField label="Frequency (Hz)" size="lg">
            <input type="number" value={frequency} onChange={(e) => setFrequency(e.target.value)} placeholder="e.g. 439987500" />
          </ControlField>
          <ControlField label="Baud" size="sm">
            <select value={baudRate} onChange={(e) => setBaudRate(Number(e.target.value))}>
              <option value={512}>512</option>
              <option value={1200}>1200</option>
              <option value={2400}>2400</option>
            </select>
          </ControlField>
          <ControlField label={`TX VGA ${vgaGain} dB`} size="md">
            <input type="range" min={0} max={47} value={vgaGain} onChange={(e) => setVgaGain(Number(e.target.value))} />
          </ControlField>
          <ControlField label="Amp" size="sm">
            <input type="checkbox" checked={ampEnabled} onChange={(e) => setAmpEnabled(e.target.checked)} />
          </ControlField>
        </ControlRow>
      }
      footer={<RecordBar appId={"pocsag_tx" as any} format="iq" />}
    >
      {showLegal && <LegalBanner onAccept={() => setShowLegal(false)} />}
      <div className="app-shell__grow" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignContent: "start", minHeight: 0 }}>
        <div style={{ padding: 16, background: "rgba(255,255,255,0.55)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.7)", backdropFilter: "blur(16px)" }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 650, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--text-secondary)" }}>Page</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--text-secondary)" }}>RIC (0–2097151)</span>
              <input type="number" value={ric} onChange={(e) => setRic(e.target.value)} placeholder="1234567" />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--text-secondary)" }}>Function</span>
              <select value={funcBits} onChange={(e) => setFuncBits(Number(e.target.value))}>
                <option value={0}>A (0)</option>
                <option value={1}>B (1)</option>
                <option value={2}>C (2)</option>
                <option value={3}>D (3)</option>
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--text-secondary)" }}>Message Type</span>
              <select value={messageType} onChange={(e) => setMessageType(e.target.value as any)}>
                <option value="alphanumeric">Alphanumeric</option>
                <option value="numeric">Numeric</option>
                <option value="tone_only">Tone Only</option>
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--text-secondary)" }}>Message</span>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} disabled={messageType === "tone_only"} rows={4} />
            </label>
          </div>
        </div>
        <div style={{ padding: 16, background: "rgba(255,255,255,0.55)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.7)", backdropFilter: "blur(16px)" }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 650, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--text-secondary)" }}>Status</h3>
          {txStatus ? (
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text-primary)" }}>
              <div>Kind: {txStatus.kind}</div>
              {txStatus.progress_pct !== undefined && <div>Progress: {txStatus.progress_pct}%</div>}
              {txStatus.message && <div>Message: {txStatus.message}</div>}
            </div>
          ) : (
            <div style={{ color: "var(--text-tertiary)", fontSize: 13 }}>
              No transmission yet. Configure the page on the left, arm TX, then press Transmit.
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
