import { useEffect, useRef, useState } from "react";

type Unit = "MHz" | "kHz" | "Hz";

const FACTOR: Record<Unit, number> = { MHz: 1e6, kHz: 1e3, Hz: 1 };

function fmt(hz: number, unit: Unit): string {
  const v = hz / FACTOR[unit];
  // Strip trailing zeros after the decimal but keep enough precision.
  if (unit === "Hz") return Math.round(v).toString();
  const s = v.toFixed(unit === "MHz" ? 4 : 3);
  return s.replace(/\.?0+$/, "");
}

interface Props {
  hz: number;
  onChange: (hz: number) => void;
  defaultUnit?: Unit;
  /** If true, automatically picks the most readable unit on first mount. */
  autoUnit?: boolean;
}

function pickUnit(hz: number): Unit {
  if (hz >= 1e6) return "MHz";
  if (hz >= 1e3) return "kHz";
  return "Hz";
}

export function FrequencyInput({ hz, onChange, defaultUnit, autoUnit }: Props) {
  const [unit, setUnit] = useState<Unit>(() => defaultUnit ?? (autoUnit ? pickUnit(hz) : "MHz"));
  const [text, setText] = useState(() => fmt(hz, unit));
  const focused = useRef(false);

  // External changes to hz reflect in the text — but don't fight the user
  // while they're typing.
  useEffect(() => {
    if (!focused.current) setText(fmt(hz, unit));
  }, [hz, unit]);

  const handleText = (v: string) => {
    setText(v);
    const n = parseFloat(v);
    if (isFinite(n)) onChange(n * FACTOR[unit]);
  };

  const handleUnit = (next: Unit) => {
    setUnit(next);
    setText(fmt(hz, next));
  };

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "stretch" }}>
      <input
        value={text}
        onChange={(e) => handleText(e.target.value)}
        onFocus={() => { focused.current = true; }}
        onBlur={() => { focused.current = false; setText(fmt(hz, unit)); }}
        style={{ flex: 1, minWidth: 0 }}
      />
      <select
        value={unit}
        onChange={(e) => handleUnit(e.target.value as Unit)}
        style={{ width: 70 }}
      >
        <option value="MHz">MHz</option>
        <option value="kHz">kHz</option>
        <option value="Hz">Hz</option>
      </select>
    </div>
  );
}
