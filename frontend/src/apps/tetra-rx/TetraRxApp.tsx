import { DigitalVoiceRxInner } from "../dmr-rx/DigitalVoiceRxInner";

export function TetraRxApp() {
  return (
    <DigitalVoiceRxInner
      appId="tetra_rx"
      title="TETRA Receiver"
      protocol="TETRA"
      defaultFreqHz={380_000_000}
    />
  );
}
