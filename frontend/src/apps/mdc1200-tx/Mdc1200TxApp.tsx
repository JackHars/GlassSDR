import { useState, useMemo } from "react";
import { RecordBar } from "../../components/RecordBar";
import { AppScreen } from "../../components/kit/AppScreen";
import { ArmConsole } from "../../components/kit/ArmConsole";
import { GlassPanel } from "../../components/kit/GlassPanel";
import { Icon, type IconName } from "../../components/kit/Icon";
import "./Mdc1200Tx.css";

interface OpType {
  label: string;
  opcode: number;
  icon: IconName;
  desc: string;
}

const OP_TYPES: OpType[] = [
  { label: "PTT-ID",      opcode: 0x01, icon: "megaphone", desc: "Radio identifies on key-up" },
  { label: "Emergency",   opcode: 0x00, icon: "warning", desc: "Emergency alert burst"       },
  { label: "Call Alert",  opcode: 0x23, icon: "route", desc: "Dispatcher pages a unit"     },
];

/** MDC-1200 frame sections for the burst-preview visualization.
 *  Sizes are illustrative proportional to real bit counts. */
const FRAME_SECTIONS = [
  { id: "preamble", label: "PREAMBLE", bits: 40, kind: "alt" as const },
  { id: "sync",     label: "SYNC",     bits: 16, kind: "sync" as const },
  { id: "op",       label: "OP",       bits:  8, kind: "data" as const },
  { id: "id",       label: "UNIT ID",  bits: 16, kind: "data" as const },
  { id: "crc",      label: "CRC",      bits: 16, kind: "crc" as const  },
] as const;

const TOTAL_BITS = FRAME_SECTIONS.reduce((s, f) => s + f.bits, 0);

function BurstPreview({ unitId, opcode }: { unitId: number; opcode: number }) {
  const unitHex = unitId.toString(16).toUpperCase().padStart(4, "0");
  const opHex = opcode.toString(16).toUpperCase().padStart(2, "0");

  const cells = useMemo(() => {
    const out: { key: string; kind: string; bit: number }[] = [];
    FRAME_SECTIONS.forEach((sec) => {
      for (let i = 0; i < sec.bits; i++) {
        out.push({
          key: `${sec.id}-${i}`,
          kind: sec.kind,
          bit: sec.kind === "alt" ? i % 2 : (i % 3 === 0 ? 1 : 0),
        });
      }
    });
    return out;
  }, []);

  return (
    <div className="mdc-tx__burst">
      {/* Section labels */}
      <div className="mdc-tx__burst-labels">
        {FRAME_SECTIONS.map((sec) => (
          <div
            key={sec.id}
            className={`mdc-tx__burst-label mdc-tx__burst-label--${sec.kind}`}
            style={{ flex: sec.bits / TOTAL_BITS }}
          >
            {sec.label}
          </div>
        ))}
      </div>

      {/* Bit cells */}
      <div className="mdc-tx__burst-cells">
        {cells.map((c) => (
          <div
            key={c.key}
            className={`mdc-tx__burst-cell mdc-tx__burst-cell--${c.kind}${c.bit ? " mdc-tx__burst-cell--hi" : ""}`}
          />
        ))}
      </div>

      {/* Tone legend */}
      <div className="mdc-tx__tone-legend">
        <span className="mdc-tx__tone-item mdc-tx__tone-item--lo">1200 Hz</span>
        <span className="mdc-tx__tone-item mdc-tx__tone-item--hi">1800 Hz</span>
      </div>

      {/* Decoded packet summary */}
      <div className="mdc-tx__pkt-summary">
        <span className="mdc-tx__pkt-field">
          <span className="mdc-tx__pkt-key">UNIT</span>
          <span className="mdc-tx__pkt-val">{unitHex}</span>
        </span>
        <span className="mdc-tx__pkt-sep">·</span>
        <span className="mdc-tx__pkt-field">
          <span className="mdc-tx__pkt-key">OP</span>
          <span className="mdc-tx__pkt-val">{opHex}</span>
        </span>
        <span className="mdc-tx__pkt-sep">·</span>
        <span className="mdc-tx__pkt-field">
          <span className="mdc-tx__pkt-key">BITS</span>
          <span className="mdc-tx__pkt-val">{TOTAL_BITS}</span>
        </span>
        <span className="mdc-tx__pkt-sep">·</span>
        <span className="mdc-tx__pkt-field">
          <span className="mdc-tx__pkt-key">RATE</span>
          <span className="mdc-tx__pkt-val">1200 bd</span>
        </span>
      </div>
    </div>
  );
}

export function Mdc1200TxApp() {
  const [selectedOp, setSelectedOp] = useState(0); // index into OP_TYPES
  const [unitIdHex, setUnitIdHex] = useState("1234");
  const [frequency, setFrequency] = useState("462550000");
  const [vgaGain, setVgaGain] = useState(20);

  const op = OP_TYPES[selectedOp];
  const unitIdNum = useMemo(() => parseInt(unitIdHex, 16) & 0xffff, [unitIdHex]);
  const freqNum = useMemo(() => parseFloat(frequency) || 0, [frequency]);

  return (
    <AppScreen
      appId="mdc1200_tx"
      title="MDC-1200 Encoder"
      subtitle="FSK · 1200 / 1800 Hz"
      status="idle"
      statusText="Disarmed"
    >
      {/* Operation type selector */}
      <div className="mdc-tx__op-row">
        {OP_TYPES.map((o, i) => (
          <button
            key={o.opcode}
            className={`mdc-tx__op-btn${i === selectedOp ? " mdc-tx__op-btn--sel" : ""}${o.label === "Emergency" ? " mdc-tx__op-btn--emerg" : ""}`}
            onClick={() => setSelectedOp(i)}
            aria-pressed={i === selectedOp}
          >
            <span className="mdc-tx__op-icon"><Icon name={o.icon} size={16} /></span>
            <span className="mdc-tx__op-label">{o.label}</span>
            <span className="mdc-tx__op-desc">{o.desc}</span>
          </button>
        ))}
      </div>

      <div className="mdc-tx__layout">
        {/* Left — params */}
        <GlassPanel title="Packet Parameters" size="fill" pad="md" className="mdc-tx__params-panel">
          <div className="mdc-tx__field-stack">
            <div className="mdc-tx__field">
              <label className="mdc-tx__field-label">Unit ID</label>
              <div className="mdc-tx__input-wrap">
                <span className="mdc-tx__input-prefix">0x</span>
                <input
                  className="mdc-tx__input"
                  value={unitIdHex}
                  maxLength={4}
                  placeholder="1234"
                  spellCheck={false}
                  onChange={(e) =>
                    setUnitIdHex(e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 4))
                  }
                />
              </div>
              <span className="mdc-tx__field-sub">{unitIdNum} decimal</span>
            </div>

            <div className="mdc-tx__field">
              <label className="mdc-tx__field-label">Frequency</label>
              <div className="mdc-tx__input-wrap">
                <input
                  className="mdc-tx__input mdc-tx__input--freq"
                  type="number"
                  value={frequency}
                  placeholder="462550000"
                  onChange={(e) => setFrequency(e.target.value)}
                />
                <span className="mdc-tx__input-suffix">Hz</span>
              </div>
              {freqNum > 0 && (
                <span className="mdc-tx__field-sub">
                  {(freqNum / 1e6).toFixed(4)} MHz
                </span>
              )}
            </div>

            <div className="mdc-tx__field">
              <label className="mdc-tx__field-label">TX VGA · {vgaGain} dB</label>
              <input
                type="range"
                className="mdc-tx__slider"
                min={0}
                max={47}
                value={vgaGain}
                onChange={(e) => setVgaGain(+e.target.value)}
              />
            </div>

            <div className="mdc-tx__opcode-row">
              <span className="mdc-tx__opcode-key">Opcode</span>
              <span className="mdc-tx__opcode-val">
                0x{op.opcode.toString(16).toUpperCase().padStart(2, "0")}
              </span>
              <span className="mdc-tx__opcode-name">{op.label}</span>
            </div>
          </div>
        </GlassPanel>

        {/* Right — burst preview hero */}
        <GlassPanel title="Burst Preview" size="fill" pad="md" className="mdc-tx__preview-panel">
          <BurstPreview unitId={unitIdNum} opcode={op.opcode} />
        </GlassPanel>
      </div>

      <ArmConsole
        appId="mdc1200_tx"
        buildParams={() => ({
          center_hz: freqNum,
          unit_id: unitIdNum,
          opcode: op.opcode,
          vga_gain_db: vgaGain,
          amp_enabled: false,
        })}
        warning="own-devices-only"
        transmitLabel="TRANSMIT"
      />

      <RecordBar
        appId={"mdc1200_tx" as Parameters<typeof RecordBar>[0]["appId"]}
        format="iq"
        centerHz={freqNum || undefined}
      />
    </AppScreen>
  );
}
