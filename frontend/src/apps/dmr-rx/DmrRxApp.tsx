import { DigitalVoiceRxInner } from "./DigitalVoiceRxInner";

export function DmrRxApp() {
  return (
    <DigitalVoiceRxInner
      appId="dmr_rx"
      title="DMR Receiver"
      protocol="DMR"
      defaultFreqHz={439_000_000}
    />
  );
}
