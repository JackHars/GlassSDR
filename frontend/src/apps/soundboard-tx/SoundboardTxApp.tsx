import { useState, useEffect } from "react";
import { useStore } from "../../store";
import { armTx, disarmTx, startApp } from "../../ipc/commands";
import { onTxStatus } from "../../ipc/events";
import { LegalBanner } from "../../components/LegalBanner";
import { RecordBar } from "../../components/RecordBar";
import { AppShell, ControlField, ControlRow } from "../../components/AppShell";

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
    await armTx(); setArmed(true);
  };
  const handleDisarm = async () => { await disarmTx(); setArmed(false); };
  const handleTransmit = async () => {
    if (!armed) return;
    await startApp("soundboard_tx" as any, {
      clip_id: clipId,
      center_hz: parseFloat(frequency) || 0,
      vga_gain_db: vgaGain, amp_enabled: ampEnabled,
    });
    setArmed(false);
  };

  return (
    <AppShell
      title="Audio Transmitter"
      status={
        armed ? <><span style={{color: "#FF9500"}}>●</span> Armed</>
        : txStatus?.kind === "transmitting" ? <><span style={{color: "#FF3B30"}}>●</span> Transmitting{txStatus.progress_pct !== undefined ? ` ${txStatus.progress_pct}%` : ""}</>
        : <><span style={{color: "#999"}}>○</span> Idle</>
      }
      controls={
        <ControlRow
          actions={
            !armed
              ? <button className="glass-btn" onClick={handleArm} style={{ background: "#FF9500", color: "#fff" }}>ARM TX</button>
              : <>
                  <button className="glass-btn" onClick={handleDisarm}>Disarm</button>
                  <button className="glass-btn" onClick={handleTransmit} style={{ background: "#FF3B30", color: "#fff", fontWeight: 700 }}>TRANSMIT</button>
                </>
          }
        >
          <ControlField label="Clip" size="md">
            <select value={clipId} onChange={(e) => setClipId(e.target.value)}>
              {CLIPS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </ControlField>
          <ControlField label="Frequency (Hz)" size="lg">
            <input type="number" value={frequency} onChange={(e) => setFrequency(e.target.value)} placeholder="e.g. 146520000" />
          </ControlField>
          <ControlField label={`TX VGA ${vgaGain} dB`} size="md">
            <input type="range" min={0} max={47} value={vgaGain} onChange={(e) => setVgaGain(Number(e.target.value))} />
          </ControlField>
          <ControlField label="Amp" size="sm">
            <input type="checkbox" checked={ampEnabled} onChange={(e) => setAmpEnabled(e.target.checked)} />
          </ControlField>
        </ControlRow>
      }
      footer={<RecordBar appId={"soundboard_tx" as any} format="iq" centerHz={parseFloat(frequency) || undefined} />}
    >
      {showLegal && <LegalBanner onAccept={() => setShowLegal(false)} />}
      <div className="app-shell__grow" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: "var(--text-secondary)" }}>
        <div style={{ fontSize: 11, fontWeight: 650, textTransform: "uppercase", letterSpacing: 0.6 }}>Selected clip</div>
        <div style={{ fontSize: 28, fontWeight: 600, color: "var(--text-primary)" }}>
          {CLIPS.find((c) => c.id === clipId)?.label}
        </div>
        {txStatus && (
          <div style={{ marginTop: 12, padding: 12, background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 8, fontFamily: "var(--font-mono)", fontSize: 12 }}>
            Status: {txStatus.kind}{txStatus.progress_pct !== undefined ? ` · ${txStatus.progress_pct}%` : ""}{txStatus.message ? ` · ${txStatus.message}` : ""}
          </div>
        )}
      </div>
    </AppShell>
  );
}
