import { useRef, useCallback, useState, KeyboardEvent } from "react";
import "./FrequencyDial.css";

interface FrequencyDialProps {
  /** Value in Hz */
  valueHz: number;
  onChangeHz: (hz: number) => void;
  /** Step size per notch in Hz */
  stepHz?: number;
  label?: string;
  /** Format function for display */
  format?: (hz: number) => string;
}

function defaultFormat(hz: number): string {
  if (hz >= 1e9) return `${(hz / 1e9).toFixed(6)} GHz`;
  if (hz >= 1e6) return `${(hz / 1e6).toFixed(6)} MHz`;
  if (hz >= 1e3) return `${(hz / 1e3).toFixed(3)} kHz`;
  return `${hz.toFixed(0)} Hz`;
}

/** Scroll-wheel / arrow-key frequency tuning display.
 *  Drag up/down or use arrow keys to tune; scroll wheel for fast sweep. */
export function FrequencyDial({
  valueHz,
  onChangeHz,
  stepHz = 100,
  label,
  format = defaultFormat,
}: FrequencyDialProps) {
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startY: number; startHz: number } | null>(null);

  const nudge = useCallback((delta: number) => {
    onChangeHz(Math.max(0, valueHz + delta * stepHz));
  }, [valueHz, stepHz, onChangeHz]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const steps = -Math.sign(e.deltaY) * (e.shiftKey ? 100 : e.altKey ? 10 : 1);
    nudge(steps);
  }, [nudge]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setDragging(true);
    dragRef.current = { startY: e.clientY, startHz: valueHz };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dy = dragRef.current.startY - ev.clientY;
      const steps = Math.round(dy / 2);
      onChangeHz(Math.max(0, dragRef.current.startHz + steps * stepHz));
    };
    const onUp = () => {
      setDragging(false);
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [valueHz, stepHz, onChangeHz]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "ArrowUp")   { e.preventDefault(); nudge(e.shiftKey ? 100 : 1); }
    if (e.key === "ArrowDown") { e.preventDefault(); nudge(e.shiftKey ? -100 : -1); }
  }, [nudge]);

  return (
    <div className={`freq-dial${dragging ? " freq-dial--dragging" : ""}`}>
      {label && <span className="freq-dial__label">{label}</span>}
      <div
        className="freq-dial__display"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="spinbutton"
        aria-valuenow={valueHz}
        aria-label={label ?? "Frequency"}
      >
        <span className="freq-dial__value">{format(valueHz)}</span>
        <div className="freq-dial__knob">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 4l-3 3h6L8 4zm0 8l3-3H5l3 3z" fill="var(--accent)" opacity="0.6" />
          </svg>
        </div>
      </div>
    </div>
  );
}

/* ── Keypad ──────────────────────────────────────────────────────────────── */

interface KeypadProps {
  onKey: (key: string) => void;
  label?: string;
}

const KEYPAD_ROWS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  [".", "0", "⌫"],
];

/** Tactile numpad for frequency / capcode entry in instrument apps. */
export function Keypad({ onKey, label }: KeypadProps) {
  return (
    <div className="keypad">
      {label && <span className="keypad__label">{label}</span>}
      <div className="keypad__grid">
        {KEYPAD_ROWS.map((row) =>
          row.map((k) => (
            <button
              key={k}
              className="keypad__key"
              onClick={() => onKey(k)}
              aria-label={k === "⌫" ? "Backspace" : k}
            >
              {k}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
