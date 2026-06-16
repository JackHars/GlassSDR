import { DigitalVoiceRxInner } from "../dmr-rx/DigitalVoiceRxInner";

export function NxdnRxApp() {
  return (
    <DigitalVoiceRxInner
      appId="nxdn_rx"
      title="NXDN Receiver"
      protocol="NXDN"
      defaultFreqHz={439_000_000}
    />
  );
}
