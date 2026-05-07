import { useState } from "react";
import { TxAppShell, ControlField } from "../../components/TxAppShell";

export function Rfm69TxApp() {
  const [frequency, setFrequency] = useState("433920000");
  const [nodeAddr, setNodeAddr] = useState("0x01");
  const [vgaGain, setVgaGain] = useState(20);
  const [ampEnabled, setAmpEnabled] = useState(false);

  return (
    <TxAppShell
      title="RFM69 Transmitter"
      appId={"rfm69_tx" as any}
      subtitle="FSK · 433/868/915 MHz ISM"
      warning="own-devices-only"
      centerHz={parseFloat(frequency) || undefined}
      buildParams={() => ({
        center_hz: parseFloat(frequency) || 433920000,
        node_addr: parseInt(nodeAddr, 16) || 1,
        vga_gain_db: vgaGain,
        amp_enabled: ampEnabled,
      })}
      fields={
        <>
          <ControlField label="Frequency (Hz)" size="lg">
            <input type="number" value={frequency} onChange={(e) => setFrequency(e.target.value)} placeholder="433920000" />
          </ControlField>
          <ControlField label="Node Addr (hex)" size="sm">
            <input type="text" value={nodeAddr} onChange={(e) => setNodeAddr(e.target.value)} placeholder="0x01" />
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
