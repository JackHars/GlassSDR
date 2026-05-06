import { useState, useEffect } from "react";
import { useStore } from "../../store";
import { armTx, disarmTx, startApp } from "../../ipc/commands";
import { onTxStatus } from "../../ipc/events";
import { LegalBanner } from "../../components/LegalBanner";

const WARNING_BANNER = (
  <div style={{ background: "#300", border: "1px solid #f44", borderRadius: 4, padding: "8px 12px", marginBottom: 12, color: "#f88", fontSize: 13 }}>
    <strong>INDOOR TEST ONLY</strong> — Transmitting on 1090 MHz requires explicit authorization.
    Use only in a shielded environment with a dummy load. Jamming ADS-B receivers is a federal crime.
  </div>
);

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
    await armTx();
    setArmed(true);
  };

  const handleDisarm = async () => {
    await disarmTx();
    setArmed(false);
  };

  const handleTransmit = async () => {
    if (!armed) return;
    await startApp("adsb_tx" as any, {
      center_hz: 1090e6,
      icao24: parseInt(icao24, 16) || 0,
      lat: parseFloat(lat) || 0,
      lon: parseFloat(lon) || 0,
      alt_ft: parseInt(altFt, 10) || 0,
      vga_gain_db: vgaGain,
      amp_enabled: ampEnabled,
    });
    setArmed(false);
  };

  const inputStyle = { background: "#222", color: "#eee", border: "1px solid #444", padding: 4 };

  return (
    <div style={{ padding: 16 }}>
      {showLegal && <LegalBanner onAccept={() => setShowLegal(false)} />}
      <h2>ADS-B TX</h2>
      {WARNING_BANNER}
      <p style={{ color: "#aaa", fontSize: 13 }}>Transmit ADS-B position frames at 1090 MHz (OOK PPM)</p>

      <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 8, maxWidth: 500 }}>
        <label>ICAO24 (hex)</label>
        <input type="text" value={icao24} onChange={(e) => setIcao24(e.target.value.toUpperCase())} placeholder="e.g. ABCDEF" maxLength={6} style={inputStyle} />

        <label>Latitude</label>
        <input type="number" value={lat} onChange={(e) => setLat(e.target.value)} step="0.0001" style={inputStyle} />

        <label>Longitude</label>
        <input type="number" value={lon} onChange={(e) => setLon(e.target.value)} step="0.0001" style={inputStyle} />

        <label>Altitude (ft)</label>
        <input type="number" value={altFt} onChange={(e) => setAltFt(e.target.value)} style={inputStyle} />

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
