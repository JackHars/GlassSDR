import { SatImageRxInner } from "./SatImageRxInner";
export function AptRxApp() {
  return <SatImageRxInner appId="apt_rx" title="NOAA APT" defaultFreqHz={137_912_500} event="apt_line" subtitle="137.9 MHz · NOAA 15/18/19" />;
}
