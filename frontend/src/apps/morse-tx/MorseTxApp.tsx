import { useState } from "react";
import { RecordBar } from "../../components/RecordBar";
import { AppScreen } from "../../components/kit/AppScreen";
import { ArmConsole } from "../../components/kit/ArmConsole";

export function MorseTxApp() {
  const [message, setMessage] = useState("");
  const [frequency, setFrequency] = useState("7030000");
  const [wpm, setWpm] = useState(20);
  const [toneHz, setToneHz] = useState(700);
  const [vgaGain, setVgaGain] = useState(20);

  return (
    <AppScreen appId="morse_tx" title="Morse Transmitter" subtitle={`${wpm} WPM · ${toneHz} Hz`} status="idle" statusText="Ready">
      <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: "1 1 auto", minHeight: 0 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label className="app-shell__field-label">Frequency (Hz)</label>
            <input type="number" value={frequency} style={{ width: 120 }} onChange={(e) => setFrequency(e.target.value)} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label className="app-shell__field-label">Speed {wpm} WPM</label>
            <input type="range" min={5} max={40} value={wpm} onChange={(e) => setWpm(+e.target.value)} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label className="app-shell__field-label">Tone {toneHz} Hz</label>
            <input type="range" min={300} max={1000} value={toneHz} onChange={(e) => setToneHz(+e.target.value)} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label className="app-shell__field-label">VGA {vgaGain} dB</label>
            <input type="range" min={0} max={47} value={vgaGain} onChange={(e) => setVgaGain(+e.target.value)} />
          </div>
        </div>
        <ArmConsole
          appId="morse_tx"
          buildParams={() => ({ message, wpm, tone_hz: toneHz, center_hz: parseFloat(frequency) || 0, vga_gain_db: vgaGain, amp_enabled: false })}
          warning="amateur-only"
          transmitLabel="TRANSMIT"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label className="app-shell__field-label">Message (text → CW)</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="CQ CQ DE …" style={{ minHeight: 60, fontFamily: "var(--font-mono)" }} />
          </div>
        </ArmConsole>
      </div>
      <RecordBar appId={"morse_tx" as Parameters<typeof RecordBar>[0]["appId"]} format="iq" centerHz={parseFloat(frequency) || undefined} />
    </AppScreen>
  );
}
