import { useState } from "react";
import type { NfmTuning } from "../ipc/types/NfmTuning";

interface Props {
  initial: NfmTuning;
  onApply: (t: NfmTuning) => void;
  running: boolean;
}

export function TuningControls({ initial, onApply, running }: Props) {
  const [centerMhz, setCenterMhz] = useState((initial.center_hz / 1e6).toFixed(3));
  const [lna, setLna] = useState(initial.lna_gain_db);
  const [vga, setVga] = useState(initial.vga_gain_db);
  const [amp, setAmp] = useState(initial.amp_enabled);

  const apply = () => {
    onApply({
      center_hz: parseFloat(centerMhz) * 1e6,
      lna_gain_db: lna,
      vga_gain_db: vga,
      amp_enabled: amp,
      squelch_db: initial.squelch_db,
    });
  };

  return (
    <div style={{ padding: 12, background: "#222", color: "#eee" }}>
      <label>
        Frequency (MHz):{" "}
        <input
          value={centerMhz}
          onChange={(e) => setCenterMhz(e.target.value)}
          style={{ width: 100 }}
        />
      </label>
      <label style={{ marginLeft: 12 }}>
        LNA: {lna} dB
        <input
          type="range"
          min={0}
          max={40}
          step={8}
          value={lna}
          onChange={(e) => setLna(parseInt(e.target.value))}
        />
      </label>
      <label style={{ marginLeft: 12 }}>
        VGA: {vga} dB
        <input
          type="range"
          min={0}
          max={62}
          step={2}
          value={vga}
          onChange={(e) => setVga(parseInt(e.target.value))}
        />
      </label>
      <label style={{ marginLeft: 12 }}>
        <input type="checkbox" checked={amp} onChange={(e) => setAmp(e.target.checked)} />
        Amp
      </label>
      <button style={{ marginLeft: 12 }} onClick={apply}>
        {running ? "Retune" : "Start"}
      </button>
    </div>
  );
}
