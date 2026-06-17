import { DigitalVoiceRxInner } from "../dmr-rx/DigitalVoiceRxInner";

export function P25RxApp() {
  return (
    <DigitalVoiceRxInner
      appId="p25_rx"
      title="P25 Receiver"
      protocol="P25"
      defaultFreqHz={851_000_000}
    />
  );
}
