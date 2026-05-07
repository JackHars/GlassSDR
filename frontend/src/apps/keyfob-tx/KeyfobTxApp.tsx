import { useState } from "react";
import { TxAppShell, ControlField } from "../../components/TxAppShell";

export function KeyfobTxApp() {
  const [frequency, setFrequency] = useState("433920000");
  const [code, setCode] = useState("0xABCDE");
  const [bits, setBits] = useState("24");
  const [repeats, setRepeats] = useState("3");
  const [vgaGain, setVgaGain] = useState(20);
  const [ampEnabled, setAmpEnabled] = useState(false);

  return (
    <TxAppShell
      title="Keyfob Transmitter"
      appId={"keyfob_tx" as any}
      subtitle="PT2262 / EV1527 · 315/433 MHz"
      warning="own-devices-only"
      centerHz={parseFloat(frequency) || undefined}
      buildParams={() => ({
        center_hz: parseFloat(frequency) || 433920000,
        code: parseInt(code, 16) || 0,
        bits: parseInt(bits) || 24,
        repeats: parseInt(repeats) || 3,
        vga_gain_db: vgaGain,
        amp_enabled: ampEnabled,
      })}
      fields={
        <>
          <ControlField label="Frequency (Hz)" size="lg">
            <input type="number" value={frequency} onChange={(e) => setFrequency(e.target.value)} placeholder="433920000" />
          </ControlField>
          <ControlField label="Code (hex)" size="sm">
            <input type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="0xABCDE" />
          </ControlField>
          <ControlField label="Bits" size="sm">
            <input type="number" value={bits} onChange={(e) => setBits(e.target.value)} min={1} max={32} />
          </ControlField>
          <ControlField label="Repeats" size="sm">
            <input type="number" value={repeats} onChange={(e) => setRepeats(e.target.value)} min={1} max={10} />
          </ControlField>
          <ControlField label={`TX VGA ${vgaGain} dB`} size="md">
            <input type="range" min={0} max={47} value={vgaGain} onChange={(e) => setVgaGain(Number(e.target.value))} />
          </ControlField>
          <ControlField label="Amp" size="sm">
            <input type="checkbox" checked={ampEnabled} onChange={(e) => setAmpEnabled(e.target.checked)} />
          </ControlField>
        </>
      }
    />
  );
}
