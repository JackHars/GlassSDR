import { useState } from "react";
import { RecordBar } from "../../components/RecordBar";
import { AppScreen } from "../../components/kit/AppScreen";
import { ArmConsole } from "../../components/kit/ArmConsole";
import { GlassPanel } from "../../components/kit/GlassPanel";
import "./KeyfobTx.css";

const FREQS = [
  { label: "315 MHz",     hz: 315_000_000 },
  { label: "433.92 MHz",  hz: 433_920_000 },
];

interface Button {
  id: "lock" | "unlock" | "trunk";
  label: string;
  nibble: number;
  icon: string;
}

const BUTTONS: Button[] = [
  { id: "lock",   label: "LOCK",   nibble: 0x1, icon: "🔒" },
  { id: "unlock", label: "UNLOCK", nibble: 0x2, icon: "🔓" },
  { id: "trunk",  label: "TRUNK",  nibble: 0x4, icon: "⊡" },
];

/** SVG keyfob body with three pressable buttons. */
function KeyfobGraphic({
  activeBtn,
  onPress,
}: {
  activeBtn: "lock" | "unlock" | "trunk";
  onPress: (id: "lock" | "unlock" | "trunk") => void;
}) {
  const W = 110;
  const H = 190;
  const BTN_W = 72;
  const BTN_H = 32;
  const BTN_X = (W - BTN_W) / 2;

  const btnY = [54, 98, 142];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="keyfob-tx__fob-svg" aria-label="Keyfob graphic">
      {/* Key ring */}
      <circle cx={W / 2} cy={12} r={9} fill="none"
        stroke="rgba(160,112,48,0.55)" strokeWidth={3} />
      <circle cx={W / 2} cy={12} r={4} fill="rgba(160,112,48,0.30)" />

      {/* Fob body */}
      <rect x={8} y={18} width={W - 16} height={H - 24} rx={16}
        fill="rgba(20,16,10,0.75)"
        stroke="rgba(160,112,48,0.40)"
        strokeWidth={1.5}
      />

      {/* Logo area */}
      <text x={W / 2} y={46} className="keyfob-tx__logo" textAnchor="middle">◈ AUTO</text>

      {/* Buttons */}
      {BUTTONS.map((btn, i) => {
        const y = btnY[i];
        const isSel = btn.id === activeBtn;
        return (
          <g
            key={btn.id}
            onClick={() => onPress(btn.id)}
            style={{ cursor: "pointer" }}
            role="button"
            aria-pressed={isSel}
          >
            {/* Button shadow */}
            <rect x={BTN_X + 1} y={y + 2} width={BTN_W} height={BTN_H} rx={7}
              fill="rgba(0,0,0,0.35)" />
            {/* Button body */}
            <rect x={BTN_X} y={y} width={BTN_W} height={BTN_H} rx={7}
              fill={isSel ? "rgba(160,112,48,0.55)" : "rgba(50,40,25,0.70)"}
              stroke={isSel ? "#A07030" : "rgba(160,112,48,0.25)"}
              strokeWidth={isSel ? 1.5 : 1}
            />
            {isSel && (
              <rect x={BTN_X - 2} y={y - 2} width={BTN_W + 4} height={BTN_H + 4} rx={9}
                fill="none"
                stroke="rgba(160,112,48,0.40)"
                strokeWidth={1.5}
              />
            )}
            {/* Button label */}
            <text x={W / 2} y={y + BTN_H / 2 + 1}
              className={`keyfob-tx__btn-label${isSel ? " keyfob-tx__btn-label--sel" : ""}`}
              textAnchor="middle" dominantBaseline="middle"
            >
              {btn.label}
            </text>
          </g>
        );
      })}

      {/* RF emission lines at bottom */}
      {[0, 1, 2].map((i) => (
        <path
          key={i}
          d={`M ${W / 2 - 8 - i * 7} ${H - 16 - i * 3} Q ${W / 2} ${H - 22 - i * 3} ${W / 2 + 8 + i * 7} ${H - 16 - i * 3}`}
          fill="none"
          stroke={`rgba(160,112,48,${0.45 - i * 0.12})`}
          strokeWidth={0.8}
        />
      ))}
    </svg>
  );
}

export function KeyfobTxApp() {
  const [freqIdx, setFreqIdx] = useState(1); // default 433.92
  const [activeBtn, setActiveBtn] = useState<"lock" | "unlock" | "trunk">("lock");
  const [baseAddrHex, setBaseAddrHex] = useState("ABCDE");
  const [repeats, setRepeats] = useState(3);
  const [vgaGain, setVgaGain] = useState(20);

  const freq = FREQS[freqIdx];
  const baseAddr = parseInt(baseAddrHex, 16) & 0xfffff;
  const buttonNibble = BUTTONS.find((b) => b.id === activeBtn)!.nibble;
  const fullCode = ((baseAddr & 0xfffff) << 4) | (buttonNibble & 0xf);

  return (
    <AppScreen
      appId="keyfob_tx"
      title="Keyfob Emulator"
      subtitle={`PT2262 · ${freq.label}`}
      status="idle"
      statusText="Disarmed"
    >
      {/* Frequency selector */}
      <div className="keyfob-tx__freq-row">
        {FREQS.map((f, i) => (
          <button
            key={f.hz}
            className={`keyfob-tx__freq-btn${i === freqIdx ? " keyfob-tx__freq-btn--sel" : ""}`}
            onClick={() => setFreqIdx(i)}
            aria-pressed={i === freqIdx}
          >
            {f.label}
          </button>
        ))}
        <span className="keyfob-tx__protocol">PT2262 · OOK · 24-bit</span>
      </div>

      <div className="keyfob-tx__layout">
        {/* Left — keyfob graphic hero */}
        <GlassPanel title="Key Fob" size="fill" pad="sm" className="keyfob-tx__fob-panel">
          <div className="keyfob-tx__fob-wrap">
            <KeyfobGraphic activeBtn={activeBtn} onPress={setActiveBtn} />
          </div>
          <div className="keyfob-tx__btn-legend">
            {BUTTONS.map((b) => (
              <button
                key={b.id}
                className={`keyfob-tx__legend-btn${activeBtn === b.id ? " keyfob-tx__legend-btn--sel" : ""}`}
                onClick={() => setActiveBtn(b.id)}
                aria-pressed={activeBtn === b.id}
              >
                <span className="keyfob-tx__legend-icon">{b.icon}</span>
                {b.label}
              </button>
            ))}
          </div>
        </GlassPanel>

        {/* Right — code params */}
        <GlassPanel title="Code Parameters" size="fill" pad="md" className="keyfob-tx__params-panel">
          <div className="keyfob-tx__field-stack">
            <div className="keyfob-tx__field">
              <label className="keyfob-tx__field-label">Base Address (20-bit)</label>
              <div className="keyfob-tx__input-wrap">
                <span className="keyfob-tx__input-prefix">0x</span>
                <input
                  className="keyfob-tx__input"
                  value={baseAddrHex}
                  maxLength={5}
                  placeholder="ABCDE"
                  spellCheck={false}
                  onChange={(e) =>
                    setBaseAddrHex(
                      e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 5)
                    )
                  }
                />
              </div>
            </div>

            <div className="keyfob-tx__code-display">
              <span className="keyfob-tx__code-key">Full Code</span>
              <span className="keyfob-tx__code-val">
                0x{fullCode.toString(16).toUpperCase().padStart(6, "0")}
              </span>
              <span className="keyfob-tx__code-breakdown">
                [{baseAddr.toString(16).toUpperCase().padStart(5, "0")}
                <span className="keyfob-tx__code-nibble">
                  {buttonNibble.toString(16).toUpperCase()}
                </span>]
              </span>
            </div>

            <div className="keyfob-tx__field">
              <label className="keyfob-tx__field-label">Repeats · {repeats}×</label>
              <input
                type="range"
                className="keyfob-tx__slider"
                min={1}
                max={8}
                value={repeats}
                onChange={(e) => setRepeats(+e.target.value)}
              />
            </div>

            <div className="keyfob-tx__field">
              <label className="keyfob-tx__field-label">TX VGA · {vgaGain} dB</label>
              <input
                type="range"
                className="keyfob-tx__slider"
                min={0}
                max={47}
                value={vgaGain}
                onChange={(e) => setVgaGain(+e.target.value)}
              />
            </div>

            <div className="keyfob-tx__info-rows">
              <div className="keyfob-tx__info-row">
                <span className="keyfob-tx__info-key">Protocol</span>
                <span className="keyfob-tx__info-val">PT2262 / EV1527</span>
              </div>
              <div className="keyfob-tx__info-row">
                <span className="keyfob-tx__info-key">Code bits</span>
                <span className="keyfob-tx__info-val">24</span>
              </div>
              <div className="keyfob-tx__info-row">
                <span className="keyfob-tx__info-key">Modulation</span>
                <span className="keyfob-tx__info-val">OOK</span>
              </div>
            </div>
          </div>
        </GlassPanel>
      </div>

      <ArmConsole
        appId="keyfob_tx"
        buildParams={() => ({
          center_hz: freq.hz,
          code: fullCode,
          bits: 24,
          repeats,
          vga_gain_db: vgaGain,
          amp_enabled: false,
        })}
        warning="own-devices-only"
        warningText="AUTHORIZED USE ONLY — use only on your own vehicles and devices. Unauthorized transmission is illegal."
        transmitLabel="TRANSMIT"
      />

      <RecordBar
        appId={"keyfob_tx" as Parameters<typeof RecordBar>[0]["appId"]}
        format="iq"
        centerHz={freq.hz}
      />
    </AppScreen>
  );
}
