import { useState, useEffect } from "react";
import { useStore } from "../../store";
import { armTx, disarmTx, startApp } from "../../ipc/commands";
import { onTxStatus } from "../../ipc/events";
import { LegalBanner } from "../../components/LegalBanner";
import { RecordBar } from "../../components/RecordBar";
import { AppShell, ControlField, ControlRow } from "../../components/AppShell";

export function SstvTxApp() {
  const { legalAccepted, armed, txStatus, setArmed, setTxStatus } = useStore();
  const [showLegal, setShowLegal] = useState(false);
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
    await startApp("sstv_tx" as any, {
      width: 320, height: 240,
      center_hz: parseFloat(frequency) || 0,
      vga_gain_db: vgaGain, amp_enabled: ampEnabled,
    });
    setArmed(false);
  };

  return (
    <AppShell
      title="SSTV Transmitter"
      status={
        armed ? <><span style={{color: "#FF9500"}}>●</span> Armed</>
        : txStatus?.kind === "transmitting" ? <><span style={{color: "#FF3B30"}}>●</span> Transmitting{txStatus.progress_pct !== undefined ? ` ${txStatus.progress_pct}%` : ""}</>
        : <><span style={{color: "#999"}}>○</span> Idle · Robot36 mode</>
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
          <ControlField label="Frequency (Hz)" size="lg">
            <input type="number" value={frequency} onChange={(e) => setFrequency(e.target.value)} placeholder="e.g. 14230000" />
          </ControlField>
          <ControlField label={`TX VGA ${vgaGain} dB`} size="md">
            <input type="range" min={0} max={47} value={vgaGain} onChange={(e) => setVgaGain(Number(e.target.value))} />
          </ControlField>
          <ControlField label="Amp" size="sm">
            <input type="checkbox" checked={ampEnabled} onChange={(e) => setAmpEnabled(e.target.checked)} />
          </ControlField>
        </ControlRow>
      }
      footer={<RecordBar appId={"sstv_tx" as any} format="iq" centerHz={parseFloat(frequency) || undefined} />}
    >
      {showLegal && <LegalBanner onAccept={() => setShowLegal(false)} />}
      <div className="app-shell__grow" style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
        <div style={{ flex: 1, padding: 24, background: "rgba(255,255,255,0.55)", border: "1px dashed rgba(0,0,0,0.15)", borderRadius: 12, backdropFilter: "blur(16px)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", fontSize: 13 }}>
          Image source: 320×240 test pattern (image picker arrives in v0.4)
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
