import { useState } from "react";
import { RecordBar } from "../../components/RecordBar";
import { AppScreen } from "../../components/kit/AppScreen";
import { ArmConsole } from "../../components/kit/ArmConsole";

export function AfskTxApp() {
  const [message, setMessage] = useState("");
  const [frequency, setFrequency] = useState("144800000");
  const [markHz, setMarkHz] = useState(1200);
  const [spaceHz, setSpaceHz] = useState(2200);
  const [baud, setBaud] = useState(1200);
  const [vgaGain, setVgaGain] = useState(20);

  return (
    <AppScreen appId="afsk_tx" title="AFSK Transmitter" subtitle={`${markHz}/${spaceHz} Hz`} status="idle" statusText="Ready">
      <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: "1 1 auto", minHeight: 0 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label className="app-shell__field-label">Frequency (Hz)</label>
            <input type="number" value={frequency} style={{ width: 130 }} onChange={(e) => setFrequency(e.target.value)} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label className="app-shell__field-label">Mark</label>
            <input type="number" value={markHz} style={{ width: 75 }} onChange={(e) => setMarkHz(+e.target.value)} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label className="app-shell__field-label">Space</label>
            <input type="number" value={spaceHz} style={{ width: 75 }} onChange={(e) => setSpaceHz(+e.target.value)} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label className="app-shell__field-label">Baud</label>
            <input type="number" value={baud} style={{ width: 75 }} onChange={(e) => setBaud(+e.target.value)} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label className="app-shell__field-label">VGA {vgaGain} dB</label>
            <input type="range" min={0} max={47} value={vgaGain} onChange={(e) => setVgaGain(+e.target.value)} />
          </div>
        </div>
        <ArmConsole
          appId="afsk_tx"
          buildParams={() => ({ message, mark_hz: markHz, space_hz: spaceHz, baud, center_hz: parseFloat(frequency) || 0, vga_gain_db: vgaGain, amp_enabled: false })}
          warning="own-devices-only"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label className="app-shell__field-label">Message</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Text to encode…" style={{ minHeight: 80 }} />
          </div>
        </ArmConsole>
      </div>
      <RecordBar appId={"afsk_tx" as Parameters<typeof RecordBar>[0]["appId"]} format="iq" centerHz={parseFloat(frequency) || undefined} />
    </AppScreen>
  );
}
