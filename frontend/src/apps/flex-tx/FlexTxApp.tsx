import { useState } from "react";
import { RecordBar } from "../../components/RecordBar";
import { AppScreen } from "../../components/kit/AppScreen";
import { ArmConsole } from "../../components/kit/ArmConsole";

export function FlexTxApp() {
  const [capcode, setCapcode] = useState("");
  const [message, setMessage] = useState("");
  const [frequency, setFrequency] = useState("931762500");
  const [vgaGain, setVgaGain] = useState(20);

  return (
    <AppScreen appId="flex_tx" title="FLEX Transmitter" subtitle="1600 bps · 2-FSK" status="idle" statusText="Ready">
      <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: "1 1 auto", minHeight: 0 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label className="app-shell__field-label">Frequency (Hz)</label>
            <input type="number" value={frequency} style={{ width: 130 }} onChange={(e) => setFrequency(e.target.value)} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label className="app-shell__field-label">VGA {vgaGain} dB</label>
            <input type="range" min={0} max={47} value={vgaGain} onChange={(e) => setVgaGain(+e.target.value)} />
          </div>
        </div>
        <ArmConsole
          appId="flex_tx"
          buildParams={() => ({ capcode: parseInt(capcode, 10) || 0, message, center_hz: parseFloat(frequency) || 0, vga_gain_db: vgaGain, amp_enabled: false })}
          warning="own-devices-only"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label className="app-shell__field-label">Capcode (0–2097151999)</label>
              <input type="number" value={capcode} onChange={(e) => setCapcode(e.target.value)} placeholder="1234567890" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label className="app-shell__field-label">Message</label>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Pager message…" style={{ minHeight: 60 }} />
            </div>
          </div>
        </ArmConsole>
      </div>
      <RecordBar appId={"flex_tx" as Parameters<typeof RecordBar>[0]["appId"]} format="iq" centerHz={parseFloat(frequency) || undefined} />
    </AppScreen>
  );
}
