import { DigitalVoiceRxInner } from "../dmr-rx/DigitalVoiceRxInner";

export function DpmrRxApp() {
  return (
    <DigitalVoiceRxInner
      appId="dpmr_rx"
      title="dPMR Receiver"
      protocol="dPMR"
      defaultFreqHz={446_000_000}
    />
  );
}
