import { useState } from "react";
import { TxAppShell, ControlField } from "../../components/TxAppShell";

export function FlipperTxApp() {
  const [frequency, setFrequency] = useState("433920000");
  const [subContent, setSubContent] = useState("");
  const [vgaGain, setVgaGain] = useState(20);
  const [ampEnabled, setAmpEnabled] = useState(false);

  return (
    <TxAppShell
      title="Flipper Replay"
      appId={"flipper_tx" as any}
      subtitle="Sub-GHz .sub file replay"
      warning="own-devices-only"
      centerHz={parseFloat(frequency) || undefined}
      buildParams={() => ({
        center_hz: parseFloat(frequency) || 433920000,
        sub_content: subContent,
        vga_gain_db: vgaGain,
        amp_enabled: ampEnabled,
      })}
      fields={
        <>
          <ControlField label="Frequency (Hz)" size="lg">
            <input type="number" value={frequency} onChange={(e) => setFrequency(e.target.value)} placeholder="433920000" />
          </ControlField>
          <ControlField label={`TX VGA ${vgaGain} dB`} size="md">
            <input type="range" min={0} max={47} value={vgaGain} onChange={(e) => setVgaGain(Number(e.target.value))} />
          </ControlField>
          <ControlField label="Amp" size="sm">
            <input type="checkbox" checked={ampEnabled} onChange={(e) => setAmpEnabled(e.target.checked)} />
          </ControlField>
        </>
      }
    >
      <div style={{ flex: 1, padding: 16, background: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.7)", borderRadius: 12, backdropFilter: "blur(16px)", display: "flex", flexDirection: "column", gap: 8, minHeight: 0 }}>
        <label style={{ fontSize: 11, fontWeight: 650, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--text-secondary)" }}>.sub File Content</label>
        <textarea value={subContent} onChange={(e) => setSubContent(e.target.value)}
          placeholder={"Frequency: 433920000\nRAW_Data: 500 -500 500 -500"}
          style={{ flex: 1, resize: "none", fontFamily: "var(--font-mono)", fontSize: 12, minHeight: 160 }} />
      </div>
    </TxAppShell>
  );
}
