import { useState } from "react";
import { RecordBar } from "../../components/RecordBar";
import { AppScreen } from "../../components/kit/AppScreen";
import { ArmConsole } from "../../components/kit/ArmConsole";

export function SstvTxApp() {
  const [frequency, setFrequency] = useState("14230000");
  const [vgaGain, setVgaGain] = useState(20);

  return (
    <AppScreen appId="sstv_tx" title="SSTV Transmitter" subtitle="Robot36 mode · 320×240" status="idle" statusText="Ready">
      <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: "1 1 auto", minHeight: 0 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label className="app-shell__field-label">Frequency (Hz)</label>
            <input type="number" value={frequency} style={{ width: 130 }} onChange={(e) => setFrequency(e.target.value)} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label className="app-shell__field-label">TX VGA {vgaGain} dB</label>
            <input type="range" min={0} max={47} value={vgaGain} onChange={(e) => setVgaGain(+e.target.value)} />
          </div>
        </div>
        <ArmConsole
          appId="sstv_tx"
          buildParams={() => ({ width: 320, height: 240, center_hz: parseFloat(frequency) || 0, vga_gain_db: vgaGain, amp_enabled: false })}
          warning="amateur-only"
          transmitLabel="TRANSMIT"
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "rgba(0,0,0,0.04)", borderRadius: 8, border: "1px dashed rgba(0,0,0,0.12)", color: "var(--text-tertiary)", fontSize: 13 }}>
            🖼 Image source: 320×240 test pattern
          </div>
        </ArmConsole>
      </div>
      <RecordBar appId={"sstv_tx" as Parameters<typeof RecordBar>[0]["appId"]} format="iq" centerHz={parseFloat(frequency) || undefined} />
    </AppScreen>
  );
}
