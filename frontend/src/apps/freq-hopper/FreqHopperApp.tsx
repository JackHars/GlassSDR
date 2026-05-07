import { useState, useEffect } from "react";
import { useStore } from "../../store";
import { armTx, disarmTx, startApp } from "../../ipc/commands";
import { onTxStatus } from "../../ipc/events";
import { LegalBanner } from "../../components/LegalBanner";
import { RecordBar } from "../../components/RecordBar";
import { AppShell, ControlField, ControlRow } from "../../components/AppShell";

export function FreqHopperApp() {
  const { legalAccepted, armed, txStatus, setArmed, setTxStatus } = useStore();
  const [showLegal, setShowLegal] = useState(false);
  const [freqList, setFreqList] = useState("144390000\n433920000\n915000000");
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
    const frequencies_hz = freqList
      .split("\n")
      .map((s) => parseFloat(s.trim()))
      .filter((f) => !isNaN(f) && f > 0);
    await startApp("freq_hopper" as any, {
      frequencies_hz, vga_gain_db: vgaGain, amp_enabled: ampEnabled,
    });
    setArmed(false);
  };

  const freqCount = freqList.split("\n").filter((s) => parseFloat(s.trim()) > 0).length;

  return (
    <AppShell
      title="Frequency Hopper"
      status={
        armed ? <><span style={{color: "#FF9500"}}>●</span> Armed · {freqCount} freqs</>
        : txStatus?.kind === "transmitting" ? <><span style={{color: "#FF3B30"}}>●</span> Hopping{txStatus.progress_pct !== undefined ? ` ${txStatus.progress_pct}%` : ""}</>
        : <><span style={{color: "#999"}}>○</span> Idle · {freqCount} freqs</>
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
          <ControlField label={`TX VGA ${vgaGain} dB`} size="md">
            <input type="range" min={0} max={47} value={vgaGain} onChange={(e) => setVgaGain(Number(e.target.value))} />
          </ControlField>
          <ControlField label="Amp" size="sm">
            <input type="checkbox" checked={ampEnabled} onChange={(e) => setAmpEnabled(e.target.checked)} />
          </ControlField>
        </ControlRow>
      }
      footer={<RecordBar appId={"freq_hopper" as any} format="iq" />}
    >
      {showLegal && <LegalBanner onAccept={() => setShowLegal(false)} />}
      <div className="app-shell__grow" style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
        <div style={{ padding: "12px 16px", background: "rgba(255,59,48,0.08)", border: "1px solid rgba(255,59,48,0.4)", borderRadius: 10, color: "#FF3B30", fontSize: 13 }}>
          <strong>INDOOR TEST ONLY</strong> — All hop frequencies must be on your own licensed spectrum.
        </div>
        <div style={{ flex: 1, padding: 16, background: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.7)", borderRadius: 12, backdropFilter: "blur(16px)", display: "flex", flexDirection: "column", gap: 8, minHeight: 0 }}>
          <label style={{ fontSize: 11, fontWeight: 650, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--text-secondary)" }}>Frequencies (one per line, in Hz)</label>
          <textarea value={freqList} onChange={(e) => setFreqList(e.target.value)} placeholder="144390000&#10;433920000&#10;915000000" style={{ flex: 1, resize: "none", fontFamily: "var(--font-mono)", minHeight: 160 }} />
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
