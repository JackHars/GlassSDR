import { useState } from "react";
import { TxAppShell, ControlField } from "../../components/TxAppShell";

export function OokEditorTxApp() {
  const [patternHex, setPatternHex] = useState("");
  const [frequency, setFrequency] = useState("");
  const [vgaGain, setVgaGain] = useState(20);
  const [ampEnabled, setAmpEnabled] = useState(false);

  return (
    <TxAppShell
      title="OOK Editor"
      appId={"ook_editor_tx" as any}
      subtitle="Custom OOK pulse pattern"
      warning="own-devices-only"
      centerHz={parseFloat(frequency) || undefined}
      buildParams={() => ({
        center_hz: parseFloat(frequency) || 0,
        pattern: patternHex
          .replace(/\s/g, "")
          .split("")
          .flatMap((c) => {
            const nibble = parseInt(c, 16);
            return [3, 2, 1, 0].map((bit) => (nibble >> bit) & 1);
          }),
        vga_gain_db: vgaGain,
        amp_enabled: ampEnabled,
      })}
      fields={
        <>
          <ControlField label="Frequency (Hz)" size="lg">
            <input type="number" value={frequency} onChange={(e) => setFrequency(e.target.value)} placeholder="e.g. 433920000" />
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
        <label style={{ fontSize: 11, fontWeight: 650, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--text-secondary)" }}>Pulse Pattern (hex nibbles)</label>
        <textarea value={patternHex} onChange={(e) => setPatternHex(e.target.value)}
          placeholder="A5 C3 F0 ..." style={{ flex: 1, resize: "none", fontFamily: "var(--font-mono)", minHeight: 160 }} />
      </div>
    </TxAppShell>
  );
}
