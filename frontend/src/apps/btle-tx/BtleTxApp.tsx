import { useState } from "react";
import { TxAppShell, ControlField } from "../../components/TxAppShell";

export function BtleTxApp() {
  const [channel, setChannel] = useState("37");
  const [frequency, setFrequency] = useState("2402000000");
  const [vgaGain, setVgaGain] = useState(20);
  const [ampEnabled, setAmpEnabled] = useState(false);

  return (
    <TxAppShell
      title="BLE Transmitter"
      appId={"btle_tx" as any}
      subtitle="2.4 GHz ISM"
      warning="own-devices-only"
      centerHz={parseFloat(frequency) || undefined}
      buildParams={() => ({
        center_hz: parseFloat(frequency) || 2402000000,
        channel: parseInt(channel) || 37,
        vga_gain_db: vgaGain,
        amp_enabled: ampEnabled,
      })}
      fields={
        <>
          <ControlField label="Channel" size="sm">
            <input type="number" value={channel} onChange={(e) => setChannel(e.target.value)} min={37} max={39} />
          </ControlField>
          <ControlField label="Frequency (Hz)" size="lg">
            <input type="number" value={frequency} onChange={(e) => setFrequency(e.target.value)} placeholder="2402000000" />
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
