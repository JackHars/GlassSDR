import { useState, useEffect } from "react";
import { useStore } from "../../store";
import { armTx, disarmTx, startApp } from "../../ipc/commands";
import { onTxStatus } from "../../ipc/events";
import { LegalBanner } from "../../components/LegalBanner";
import { RecordBar } from "../../components/RecordBar";
import { AppShell, ControlField, ControlRow } from "../../components/AppShell";

export function AdsbTxApp() {
  const { legalAccepted, armed, txStatus, setArmed, setTxStatus } = useStore();
  const [showLegal, setShowLegal] = useState(false);
  const [icao24, setIcao24] = useState("ABCDEF");
  const [lat, setLat] = useState("0.0");
  const [lon, setLon] = useState("0.0");
  const [altFt, setAltFt] = useState("35000");
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
    await startApp("adsb_tx" as any, {
      center_hz: 1090e6,
      icao24: parseInt(icao24, 16) || 0,
      lat: parseFloat(lat) || 0,
      lon: parseFloat(lon) || 0,
      alt_ft: parseInt(altFt, 10) || 0,
      vga_gain_db: vgaGain, amp_enabled: ampEnabled,
    });
    setArmed(false);
  };

  return (
    <AppShell
      title="ADS-B Transmitter"
      status={
        armed ? <><span style={{color: "#FF9500"}}>●</span> Armed</>
        : txStatus?.kind === "transmitting" ? <><span style={{color: "#FF3B30"}}>●</span> Transmitting{txStatus.progress_pct !== undefined ? ` ${txStatus.progress_pct}%` : ""}</>
        : <><span style={{color: "#999"}}>○</span> Idle · 1090 MHz · OOK PPM</>
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
          <ControlField label="ICAO24 (hex)" size="sm">
            <input type="text" value={icao24} onChange={(e) => setIcao24(e.target.value.toUpperCase())} maxLength={6} />
          </ControlField>
          <ControlField label="Latitude" size="sm">
            <input type="number" value={lat} onChange={(e) => setLat(e.target.value)} step="0.0001" />
          </ControlField>
          <ControlField label="Longitude" size="sm">
            <input type="number" value={lon} onChange={(e) => setLon(e.target.value)} step="0.0001" />
          </ControlField>
          <ControlField label="Altitude (ft)" size="sm">
            <input type="number" value={altFt} onChange={(e) => setAltFt(e.target.value)} />
          </ControlField>
          <ControlField label={`TX VGA ${vgaGain} dB`} size="md">
            <input type="range" min={0} max={47} value={vgaGain} onChange={(e) => setVgaGain(Number(e.target.value))} />
          </ControlField>
          <ControlField label="Amp" size="sm">
            <input type="checkbox" checked={ampEnabled} onChange={(e) => setAmpEnabled(e.target.checked)} />
          </ControlField>
        </ControlRow>
      }
      footer={<RecordBar appId={"adsb_tx" as any} format="iq" centerHz={1_090_000_000} />}
    >
      {showLegal && <LegalBanner onAccept={() => setShowLegal(false)} />}
      <div className="app-shell__grow" style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
        <div style={{ padding: "12px 16px", background: "rgba(255,59,48,0.08)", border: "1px solid rgba(255,59,48,0.4)", borderRadius: 10, color: "#FF3B30", fontSize: 13 }}>
          <strong>INDOOR TEST ONLY</strong> — Transmitting on 1090 MHz requires explicit authorization.
          Use only in a shielded environment with a dummy load. Jamming ADS-B receivers is a federal crime.
        </div>
        <div style={{ flex: 1, padding: 16, background: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.7)", borderRadius: 12, backdropFilter: "blur(16px)" }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 650, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--text-secondary)" }}>Aircraft</h3>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text-primary)", lineHeight: 1.7 }}>
            ICAO24: <strong>{icao24}</strong><br />
            Position: {lat}, {lon}<br />
            Altitude: {altFt} ft
          </div>
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
