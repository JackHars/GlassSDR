import { useState } from "react";
import { RecordBar } from "../../components/RecordBar";
import { AppScreen } from "../../components/kit/AppScreen";
import { ArmConsole } from "../../components/kit/ArmConsole";

export function RttyTxApp() {
  const [message, setMessage] = useState("");
  const [frequency, setFrequency] = useState("14090000");
  const [vgaGain, setVgaGain] = useState(20);

  return (
    <AppScreen appId="rtty_tx" title="RTTY Transmitter" subtitle="45 baud · 170 Hz shift" status="idle" statusText="Ready">
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
          appId="rtty_tx"
          buildParams={() => ({ message, center_hz: parseFloat(frequency) || 0, vga_gain_db: vgaGain, amp_enabled: false })}
          warning="indoor-only"
          transmitLabel="TRANSMIT"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label className="app-shell__field-label">Message</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Text to transmit…" style={{ minHeight: 100 }} />
          </div>
        </ArmConsole>
      </div>
      <RecordBar appId={"rtty_tx" as Parameters<typeof RecordBar>[0]["appId"]} format="iq" centerHz={parseFloat(frequency) || undefined} />
    </AppScreen>
  );
}
