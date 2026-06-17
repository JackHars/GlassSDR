import { useState } from "react";
import { RecordBar } from "../../components/RecordBar";
import { AppScreen } from "../../components/kit/AppScreen";
import { ArmConsole } from "../../components/kit/ArmConsole";

const CLIPS = [
  { id: "default", label: "Test Tone (1 kHz)" },
  { id: "roger_beep", label: "Roger Beep" },
  { id: "cq_cq", label: "CQ CQ DE" },
];

export function SoundboardTxApp() {
  const [clipId, setClipId] = useState("default");
  const [frequency, setFrequency] = useState("146520000");
  const [vgaGain, setVgaGain] = useState(20);

  return (
    <AppScreen appId="soundboard_tx" title="Audio Transmitter" subtitle="Soundboard" status="idle" statusText="Ready">
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
          appId="soundboard_tx"
          buildParams={() => ({ clip_id: clipId, center_hz: parseFloat(frequency) || 0, vga_gain_db: vgaGain, amp_enabled: false })}
          warning="own-devices-only"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label className="app-shell__field-label">Audio Clip</label>
            {CLIPS.map((c) => (
              <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "8px 12px", background: clipId === c.id ? "var(--accent-dim)" : "rgba(255,255,255,0.5)", border: `1px solid ${clipId === c.id ? "var(--accent)" : "rgba(0,0,0,0.08)"}`, borderRadius: 8, transition: "all var(--spring-snappy)" }}>
                <input type="radio" name="clip" value={c.id} checked={clipId === c.id} onChange={() => setClipId(c.id)} style={{ accentColor: "var(--accent)" }} />
                <span style={{ fontSize: 13, color: clipId === c.id ? "var(--accent)" : "var(--text-primary)" }}>{c.label}</span>
              </label>
            ))}
          </div>
        </ArmConsole>
      </div>
      <RecordBar appId={"soundboard_tx" as Parameters<typeof RecordBar>[0]["appId"]} format="iq" centerHz={parseFloat(frequency) || undefined} />
    </AppScreen>
  );
}
