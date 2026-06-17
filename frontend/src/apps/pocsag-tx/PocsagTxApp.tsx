import { useState, useEffect } from "react";
import { useStore } from "../../store";
import { armTx, disarmTx, startApp } from "../../ipc/commands";
import { onPocsagTxStatus } from "../../ipc/events";
import { LegalBanner } from "../../components/LegalBanner";
import { RecordBar } from "../../components/RecordBar";
import { AppScreen } from "../../components/kit/AppScreen";
import { Icon } from "../../components/kit/Icon";
import type { AppStatus } from "../../components/kit/AppScreen";
import "./PocsagTx.css";
import "../../components/kit/ArmConsole.css";

export function PocsagTxApp() {
  const { legalAccepted, armed, txStatus, setArmed, setTxStatus } = useStore();
  const [showLegal, setShowLegal] = useState(false);
  const [ric, setRic] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"numeric" | "alphanumeric" | "tone_only">("alphanumeric");
  const [baudRate, setBaudRate] = useState<number>(1200);
  const [frequency, setFrequency] = useState("");
  const [vgaGain, setVgaGain] = useState(20);
  const ampEnabled = false;
  const [funcBits, setFuncBits] = useState(0);

  useEffect(() => {
    const p = onPocsagTxStatus((status) => setTxStatus(status));
    return () => { p.then((fn) => fn()); };
  }, [setTxStatus]);

  const handleArm = async () => {
    if (!legalAccepted) { setShowLegal(true); return; }
    await armTx(); setArmed(true);
  };
  const handleDisarm = async () => { await disarmTx(); setArmed(false); };
  const handleTransmit = async () => {
    if (!armed) return;
    await startApp("pocsag_tx" as Parameters<typeof startApp>[0], {
      ric: parseInt(ric, 10) || 0, function: funcBits, message,
      message_type: messageType, baud_rate: baudRate,
      center_hz: parseFloat(frequency) || 0, vga_gain_db: vgaGain, amp_enabled: ampEnabled,
    });
    setArmed(false);
  };

  const isTransmitting = txStatus?.kind === "transmitting";
  const appStatus: AppStatus = isTransmitting ? "live" : armed ? "acquiring" : "idle";

  return (
    <AppScreen
      appId="pocsag_tx"
      title="POCSAG Transmitter"
      subtitle={frequency ? `${(parseFloat(frequency) / 1e6).toFixed(4)} MHz` : undefined}
      status={appStatus}
      statusText={isTransmitting ? `Transmitting ${txStatus?.progress_pct ?? 0}%` : armed ? "Armed" : "Idle"}
      controls={
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "12px 16px", width: "100%" }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label className="app-shell__field-label">Frequency (Hz)</label>
              <input type="number" value={frequency} style={{ width: 130 }} onChange={(e) => setFrequency(e.target.value)} placeholder="439987500" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label className="app-shell__field-label">Baud</label>
              <select value={baudRate} onChange={(e) => setBaudRate(+e.target.value)} style={{ width: 80 }}>
                <option value={512}>512</option><option value={1200}>1200</option><option value={2400}>2400</option>
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label className="app-shell__field-label">TX VGA {vgaGain} dB</label>
              <input type="range" min={0} max={47} value={vgaGain} onChange={(e) => setVgaGain(+e.target.value)} />
            </div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignSelf: "flex-end" }}>
            {!armed && !isTransmitting && <button className="arm-console__btn arm-console__btn--arm" onClick={handleArm}>ARM TX</button>}
            {armed && !isTransmitting && <>
              <button className="arm-console__btn arm-console__btn--disarm" onClick={handleDisarm}>Disarm</button>
              <button className="arm-console__btn arm-console__btn--transmit" onClick={handleTransmit}>TRANSMIT</button>
            </>}
            {isTransmitting && <button className="arm-console__btn arm-console__btn--live" disabled>● Live</button>}
          </div>
        </div>
      }
      footer={<RecordBar appId={"pocsag_tx" as Parameters<typeof RecordBar>[0]["appId"]} format="iq" />}
    >
      {showLegal && <LegalBanner onAccept={() => setShowLegal(false)} />}
      <div className="arm-console">
        <div className="arm-console__warning">
          <span className="arm-console__warning-icon"><Icon name="warning" size={16} /></span>
          <span className="arm-console__warning-text">OWN DEVICES ONLY — only target devices you own and are licensed to operate.</span>
        </div>
        <div className="arm-console__body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label className="app-shell__field-label">RIC (0–2097151)</label>
              <input type="number" value={ric} onChange={(e) => setRic(e.target.value)} placeholder="1234567" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label className="app-shell__field-label">Function</label>
              <select value={funcBits} onChange={(e) => setFuncBits(+e.target.value)}>
                <option value={0}>A (0)</option><option value={1}>B (1)</option>
                <option value={2}>C (2)</option><option value={3}>D (3)</option>
              </select>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label className="app-shell__field-label">Message Type</label>
            <select value={messageType} onChange={(e) => setMessageType(e.target.value as typeof messageType)}>
              <option value="alphanumeric">Alphanumeric</option>
              <option value="numeric">Numeric</option>
              <option value="tone_only">Tone Only</option>
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label className="app-shell__field-label">Message</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} disabled={messageType === "tone_only"} rows={4} />
          </div>
        </div>
      </div>
    </AppScreen>
  );
}
