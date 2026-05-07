import { useState } from "react";
import { TxAppShell, ControlField } from "../../components/TxAppShell";

export function LgeTxApp() {
  const [frequency, setFrequency] = useState("433920000");
  const [deviceAddr, setDeviceAddr] = useState("0x01");
  const [command, setCommand] = useState("0x00");
  const [vgaGain, setVgaGain] = useState(20);
  const [ampEnabled, setAmpEnabled] = useState(false);

  return (
    <TxAppShell
      title="LGE Transmitter"
      appId={"lge_tx" as any}
      subtitle="LGE appliance OOK / ASK"
      warning="own-devices-only"
      centerHz={parseFloat(frequency) || undefined}
      buildParams={() => ({
        center_hz: parseFloat(frequency) || 433920000,
        device_addr: parseInt(deviceAddr, 16) || 0,
        command: parseInt(command, 16) || 0,
        vga_gain_db: vgaGain,
        amp_enabled: ampEnabled,
      })}
      fields={
        <>
          <ControlField label="Frequency (Hz)" size="lg">
            <input type="number" value={frequency} onChange={(e) => setFrequency(e.target.value)} placeholder="433920000" />
          </ControlField>
          <ControlField label="Device Addr (hex)" size="sm">
            <input type="text" value={deviceAddr} onChange={(e) => setDeviceAddr(e.target.value)} placeholder="0x01" />
          </ControlField>
          <ControlField label="Command (hex)" size="sm">
            <input type="text" value={command} onChange={(e) => setCommand(e.target.value)} placeholder="0x00" />
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
