import { useState } from "react";
import { RecordBar } from "../../components/RecordBar";
import { AppScreen } from "../../components/kit/AppScreen";
import { ArmConsole } from "../../components/kit/ArmConsole";
import { GlassPanel } from "../../components/kit/GlassPanel";
import "./Rfm69Tx.css";

interface IsmBand {
  label: string;
  hz: number;
  region: string;
}

const ISM_BANDS: IsmBand[] = [
  { label: "315",   hz: 315_000_000, region: "US (legacy)" },
  { label: "433",   hz: 433_920_000, region: "EU / Asia" },
  { label: "868",   hz: 868_000_000, region: "Europe" },
  { label: "915",   hz: 915_000_000, region: "Americas" },
];

/** RFM69HW module pinout — left and right pad rows (top to bottom) */
const LEFT_PINS  = ["ANT", "GND", "GND", "3.3V", "DIO2", "DIO1", "DIO0", "RESET"];
const RIGHT_PINS = ["NSS", "MOSI", "MISO", "SCK", "GND", "3.3V", "DIO5", "DIO4"];

const HIGHLIGHT_PINS = new Set(["ANT", "NSS", "MOSI", "MISO", "SCK", "3.3V", "GND"]);

function ModulePinout() {
  const PIN_H = 14;
  const PIN_COUNT = LEFT_PINS.length;
  const MOD_H = PIN_COUNT * PIN_H + 16;
  const MOD_W = 72;
  const LEFT_X = 56;
  const RIGHT_X = LEFT_X + MOD_W;
  const SVG_W = RIGHT_X + 58;
  const SVG_H = MOD_H + 20;
  const MOD_Y = 10;

  return (
    <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="rfm-tx__pinout-svg" aria-label="RFM69HW module pinout">
      {/* Module body */}
      <rect
        x={LEFT_X} y={MOD_Y}
        width={MOD_W} height={MOD_H}
        rx={4}
        fill="rgba(192,112,40,0.12)"
        stroke="rgba(192,112,40,0.40)"
        strokeWidth={1}
      />

      {/* Module label */}
      <text x={LEFT_X + MOD_W / 2} y={MOD_Y + MOD_H / 2 - 6}
        className="rfm-tx__mod-name" textAnchor="middle">RFM69</text>
      <text x={LEFT_X + MOD_W / 2} y={MOD_Y + MOD_H / 2 + 7}
        className="rfm-tx__mod-sub" textAnchor="middle">HW</text>

      {/* Left pins */}
      {LEFT_PINS.map((name, i) => {
        const y = MOD_Y + 10 + i * PIN_H;
        const isHi = HIGHLIGHT_PINS.has(name);
        return (
          <g key={`l${i}`}>
            {/* Pad */}
            <rect x={LEFT_X - 10} y={y - 3} width={10} height={6}
              rx={1}
              fill={isHi ? "rgba(192,112,40,0.50)" : "rgba(192,112,40,0.22)"}
              stroke="rgba(192,112,40,0.40)" strokeWidth={0.5}
            />
            {/* Line to label */}
            <line x1={LEFT_X - 10} y1={y} x2={LEFT_X - 16} y2={y}
              stroke="rgba(192,112,40,0.35)" strokeWidth={0.5} />
            {/* Label */}
            <text x={LEFT_X - 18} y={y + 3}
              className={`rfm-tx__pin-label${isHi ? " rfm-tx__pin-label--hi" : ""}`}
              textAnchor="end">
              {name}
            </text>
          </g>
        );
      })}

      {/* Right pins */}
      {RIGHT_PINS.map((name, i) => {
        const y = MOD_Y + 10 + i * PIN_H;
        const isHi = HIGHLIGHT_PINS.has(name);
        return (
          <g key={`r${i}`}>
            <rect x={RIGHT_X} y={y - 3} width={10} height={6}
              rx={1}
              fill={isHi ? "rgba(192,112,40,0.50)" : "rgba(192,112,40,0.22)"}
              stroke="rgba(192,112,40,0.40)" strokeWidth={0.5}
            />
            <line x1={RIGHT_X + 10} y1={y} x2={RIGHT_X + 16} y2={y}
              stroke="rgba(192,112,40,0.35)" strokeWidth={0.5} />
            <text x={RIGHT_X + 18} y={y + 3}
              className={`rfm-tx__pin-label${isHi ? " rfm-tx__pin-label--hi" : ""}`}
              textAnchor="start">
              {name}
            </text>
          </g>
        );
      })}

      {/* Antenna symbol at top */}
      <line x1={LEFT_X + MOD_W / 2} y1={MOD_Y} x2={LEFT_X + MOD_W / 2} y2={MOD_Y - 8}
        stroke="rgba(192,112,40,0.55)" strokeWidth={1} />
      <line x1={LEFT_X + MOD_W / 2 - 6} y1={MOD_Y - 6} x2={LEFT_X + MOD_W / 2 + 6} y2={MOD_Y - 6}
        stroke="rgba(192,112,40,0.40)" strokeWidth={0.8} />
      <line x1={LEFT_X + MOD_W / 2 - 4} y1={MOD_Y - 4} x2={LEFT_X + MOD_W / 2 + 4} y2={MOD_Y - 4}
        stroke="rgba(192,112,40,0.35)" strokeWidth={0.7} />
      <line x1={LEFT_X + MOD_W / 2 - 2} y1={MOD_Y - 2} x2={LEFT_X + MOD_W / 2 + 2} y2={MOD_Y - 2}
        stroke="rgba(192,112,40,0.30)" strokeWidth={0.6} />
    </svg>
  );
}

export function Rfm69TxApp() {
  const [selectedBand, setSelectedBand] = useState(1); // default 433 MHz
  const [nodeAddrHex, setNodeAddrHex] = useState("01");
  const [vgaGain, setVgaGain] = useState(20);

  const band = ISM_BANDS[selectedBand];
  const nodeAddr = parseInt(nodeAddrHex, 16) & 0xff || 1;

  return (
    <AppScreen
      appId="rfm69_tx"
      title="RFM69 Transmitter"
      subtitle={`${band.label} MHz · FSK`}
      status="idle"
      statusText="Disarmed"
    >
      {/* ISM band selector */}
      <div className="rfm-tx__band-row">
        {ISM_BANDS.map((b, i) => (
          <button
            key={b.hz}
            className={`rfm-tx__band-btn${i === selectedBand ? " rfm-tx__band-btn--sel" : ""}`}
            onClick={() => setSelectedBand(i)}
            aria-pressed={i === selectedBand}
          >
            <span className="rfm-tx__band-freq">{b.label} MHz</span>
            <span className="rfm-tx__band-region">{b.region}</span>
          </button>
        ))}
      </div>

      <div className="rfm-tx__layout">
        {/* Left — module config */}
        <GlassPanel title="Module Config" size="fill" pad="md" className="rfm-tx__config-panel">
          <div className="rfm-tx__field-stack">
            <div className="rfm-tx__field">
              <label className="rfm-tx__field-label">Node Address</label>
              <div className="rfm-tx__input-wrap">
                <span className="rfm-tx__input-prefix">0x</span>
                <input
                  className="rfm-tx__input"
                  value={nodeAddrHex}
                  maxLength={2}
                  placeholder="01"
                  spellCheck={false}
                  onChange={(e) =>
                    setNodeAddrHex(e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 2))
                  }
                />
              </div>
              <span className="rfm-tx__field-sub">Node {nodeAddr} · network broadcast</span>
            </div>

            <div className="rfm-tx__packet-info">
              <div className="rfm-tx__pkt-row">
                <span className="rfm-tx__pkt-key">Sync</span>
                <span className="rfm-tx__pkt-val">2D D4</span>
              </div>
              <div className="rfm-tx__pkt-row">
                <span className="rfm-tx__pkt-key">Payload</span>
                <span className="rfm-tx__pkt-val">48 45 4C 4C 4F 20 52 46 4D 36 39</span>
              </div>
              <div className="rfm-tx__pkt-row">
                <span className="rfm-tx__pkt-key rfm-tx__pkt-key--decoded">"HELLO RFM69"</span>
              </div>
              <div className="rfm-tx__pkt-row">
                <span className="rfm-tx__pkt-key">Modulation</span>
                <span className="rfm-tx__pkt-val rfm-tx__pkt-val--plain">FSK · GFSK</span>
              </div>
              <div className="rfm-tx__pkt-row rfm-tx__pkt-row--freq">
                <span className="rfm-tx__pkt-key">Frequency</span>
                <span className="rfm-tx__pkt-val rfm-tx__pkt-val--accent">
                  {(band.hz / 1e6).toFixed(3)} MHz
                </span>
              </div>
            </div>

            <div className="rfm-tx__field">
              <label className="rfm-tx__field-label">TX VGA · {vgaGain} dB</label>
              <input
                type="range"
                className="rfm-tx__slider"
                min={0}
                max={47}
                value={vgaGain}
                onChange={(e) => setVgaGain(+e.target.value)}
              />
            </div>
          </div>
        </GlassPanel>

        {/* Right — module pinout hero */}
        <GlassPanel title="Module Pinout (RFM69HW)" size="fill" pad="sm" className="rfm-tx__pinout-panel">
          <ModulePinout />
        </GlassPanel>
      </div>

      <ArmConsole
        appId="rfm69_tx"
        buildParams={() => ({
          center_hz: band.hz,
          node_addr: nodeAddr,
          vga_gain_db: vgaGain,
          amp_enabled: false,
        })}
        warning="own-devices-only"
        transmitLabel="TRANSMIT"
      />

      <RecordBar
        appId={"rfm69_tx" as Parameters<typeof RecordBar>[0]["appId"]}
        format="iq"
        centerHz={band.hz}
      />
    </AppScreen>
  );
}
