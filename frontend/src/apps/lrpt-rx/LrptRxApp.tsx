import { SatImageRxInner } from "../apt-rx/SatImageRxInner";
export function LrptRxApp() {
  return <SatImageRxInner appId="lrpt_rx" title="LRPT / Meteor-M" defaultFreqHz={137_100_000} event="apt_line" subtitle="137.1 MHz · Meteor-M2" />;
}
