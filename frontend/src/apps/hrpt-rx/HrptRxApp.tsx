import { SatImageRxInner } from "../apt-rx/SatImageRxInner";
export function HrptRxApp() {
  return <SatImageRxInner appId="hrpt_rx" title="HRPT Receiver" defaultFreqHz={1_698_000_000} event="apt_line" subtitle="1698 MHz · NOAA HRPT" />;
}
