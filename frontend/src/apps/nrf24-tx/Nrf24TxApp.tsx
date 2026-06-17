import { useState, useCallback } from "react";
import { RecordBar } from "../../components/RecordBar";
import { AppScreen } from "../../components/kit/AppScreen";
import { ArmConsole } from "../../components/kit/ArmConsole";
import { GlassPanel } from "../../components/kit/GlassPanel";
import "./Nrf24Tx.css";

const CH_COUNT = 126; // channels 0–125
const CH_TO_HZ = (ch: number) => (2400 + ch) * 1_000_000;

/** WiFi 2.4 GHz channel overlap zones (nRF24 channel numbers) */
const WIFI_ZONES = [
  { name: "WiFi 1",  lo: 1,  hi: 23, color: "rgba(255,140,0,0.12)" },
  { name: "WiFi 6",  lo: 26, hi: 48, color: "rgba(255,140,0,0.09)" },
  { name: "WiFi 11", lo: 51, hi: 73, color: "rgba(255,140,0,0.12)" },
];

/** BLE advertising channel positions in nRF24 channel space */
const BLE_MARKS = [
  { ch: 2,  label: "BLE 37" },
  { ch: 26, label: "BLE 38" },
  { ch: 80, label: "BLE 39" },
];

const SVG_W = 380;
const SVG_H = 72;
const PAD_X = 6;
const AXIS_Y = SVG_H - 14;
const BAR_MAX_H = AXIS_Y - 18;
const CELL_W = (SVG_W - 2 * PAD_X) / CH_COUNT;

function toX(ch: number) {
  return PAD_X + ch * CELL_W + CELL_W / 2;
}

function ChannelMap({
  selectedCh,
  onSelect,
}: {
  selectedCh: number;
  onSelect: (ch: number) => void;
}) {
  const handleClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / rect.width;
      const ch = Math.round(((relX * SVG_W - PAD_X) / (SVG_W - 2 * PAD_X)) * (CH_COUNT - 1));
      onSelect(Math.max(0, Math.min(CH_COUNT - 1, ch)));
    },
    [onSelect]
  );

  const axisMarks = [0, 25, 50, 75, 100, 125];

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      className="nrf-tx__map-svg"
      onClick={handleClick}
      aria-label="nRF24 2.4 GHz channel map — click to select"
      style={{ cursor: "crosshair" }}
    >
      {/* Background */}
      <rect x={PAD_X} y={16} width={SVG_W - 2 * PAD_X} height={AXIS_Y - 16}
        fill="rgba(8,14,38,0.45)" rx={2} />

      {/* WiFi overlap zones */}
      {WIFI_ZONES.map((z) => (
        <g key={z.name}>
          <rect
            x={PAD_X + z.lo * CELL_W} y={16}
            width={(z.hi - z.lo) * CELL_W} height={AXIS_Y - 16}
            fill={z.color}
          />
          <text
            x={PAD_X + ((z.lo + z.hi) / 2) * CELL_W} y={13}
            className="nrf-tx__zone-label" textAnchor="middle"
          >
            {z.name}
          </text>
        </g>
      ))}

      {/* BLE markers */}
      {BLE_MARKS.map((m) => (
        <g key={m.ch}>
          <line
            x1={toX(m.ch)} y1={16}
            x2={toX(m.ch)} y2={AXIS_Y}
            stroke="rgba(72,96,232,0.35)" strokeWidth={0.8} strokeDasharray="3 2"
          />
        </g>
      ))}

      {/* Channel bars */}
      {Array.from({ length: CH_COUNT }, (_, ch) => {
        const x = PAD_X + ch * CELL_W;
        const isSel = ch === selectedCh;
        const barH = isSel ? BAR_MAX_H : BAR_MAX_H * 0.4;
        return (
          <rect
            key={ch}
            x={x + 0.3} y={AXIS_Y - barH}
            width={Math.max(CELL_W - 0.6, 0.8)} height={barH}
            fill={isSel ? "#2878D8" : "rgba(40,120,216,0.30)"}
            rx={0.5}
          />
        );
      })}

      {/* Selected channel glow */}
      <rect
        x={PAD_X + selectedCh * CELL_W - 2} y={AXIS_Y - BAR_MAX_H - 4}
        width={CELL_W + 4} height={BAR_MAX_H + 4}
        fill="rgba(40,120,216,0.18)" rx={2}
      />

      {/* Selected channel callout */}
      <text
        x={Math.min(Math.max(toX(selectedCh), 20), SVG_W - 20)}
        y={AXIS_Y - BAR_MAX_H - 6}
        className="nrf-tx__sel-label" textAnchor="middle"
      >
        CH {selectedCh}
      </text>

      {/* Axis line */}
      <line x1={PAD_X} y1={AXIS_Y} x2={SVG_W - PAD_X} y2={AXIS_Y}
        stroke="rgba(40,120,216,0.25)" strokeWidth={0.8} />

      {/* Axis labels */}
      {axisMarks.map((ch) => (
        <text key={ch} x={toX(ch)} y={SVG_H - 2}
          className="nrf-tx__axis-label" textAnchor="middle">
          {ch}
        </text>
      ))}
    </svg>
  );
}

export function Nrf24TxApp() {
  const [channel, setChannel] = useState(76); // common low-interference channel
  const [vgaGain, setVgaGain] = useState(20);

  const centerHz = CH_TO_HZ(channel);
  const freqMhz = 2400 + channel;

  return (
    <AppScreen
      appId="nrf24_tx"
      title="nRF24 Transmitter"
      subtitle={`CH ${channel} · ${freqMhz} MHz`}
      status="idle"
      statusText="Disarmed"
    >
      {/* Channel map hero */}
      <GlassPanel title="2.4 GHz Channel Map (0–125 · click to select)" pad="sm" className="nrf-tx__map-panel">
        <ChannelMap selectedCh={channel} onSelect={setChannel} />
        <div className="nrf-tx__map-legend">
          <span className="nrf-tx__legend-item">
            <span className="nrf-tx__legend-swatch nrf-tx__legend-swatch--wifi" />
            WiFi overlap
          </span>
          <span className="nrf-tx__legend-item">
            <span className="nrf-tx__legend-swatch nrf-tx__legend-swatch--ble" />
            BLE adv channels
          </span>
          <span className="nrf-tx__legend-item nrf-tx__legend-item--sel">
            <span className="nrf-tx__legend-swatch nrf-tx__legend-swatch--sel" />
            Selected: CH {channel} · {freqMhz} MHz
          </span>
        </div>
      </GlassPanel>

      <div className="nrf-tx__layout">
        {/* Left — channel + gain */}
        <GlassPanel title="Channel Config" size="fill" pad="md" className="nrf-tx__config-panel">
          <div className="nrf-tx__field-stack">
            <div className="nrf-tx__field">
              <label className="nrf-tx__field-label">Channel (0–125)</label>
              <div className="nrf-tx__ch-row">
                <button
                  className="nrf-tx__step-btn"
                  onClick={() => setChannel((c) => Math.max(0, c - 1))}
                  aria-label="Decrement channel"
                >−</button>
                <input
                  className="nrf-tx__ch-input"
                  type="number"
                  min={0}
                  max={125}
                  value={channel}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!isNaN(v)) setChannel(Math.max(0, Math.min(125, v)));
                  }}
                />
                <button
                  className="nrf-tx__step-btn"
                  onClick={() => setChannel((c) => Math.min(125, c + 1))}
                  aria-label="Increment channel"
                >+</button>
              </div>
            </div>

            <div className="nrf-tx__freq-display">
              <span className="nrf-tx__freq-val">{freqMhz}</span>
              <span className="nrf-tx__freq-unit">MHz</span>
            </div>

            {/* Quick-pick common channels */}
            <div className="nrf-tx__quick-row">
              {[2, 40, 76, 100, 125].map((ch) => (
                <button
                  key={ch}
                  className={`nrf-tx__quick-btn${ch === channel ? " nrf-tx__quick-btn--sel" : ""}`}
                  onClick={() => setChannel(ch)}
                >
                  {ch}
                </button>
              ))}
            </div>

            <div className="nrf-tx__field">
              <label className="nrf-tx__field-label">TX VGA · {vgaGain} dB</label>
              <input
                type="range"
                className="nrf-tx__slider"
                min={0}
                max={47}
                value={vgaGain}
                onChange={(e) => setVgaGain(+e.target.value)}
              />
            </div>
          </div>
        </GlassPanel>

        {/* Right — frame info (display-only, backend uses hardcoded values) */}
        <GlassPanel title="ESB Frame" size="fill" pad="md" className="nrf-tx__frame-panel">
          <div className="nrf-tx__frame-fields">
            <div className="nrf-tx__frame-row">
              <span className="nrf-tx__frame-key">Address</span>
              <span className="nrf-tx__frame-val">E7:E7:E7:E7:E7</span>
            </div>
            <div className="nrf-tx__frame-row">
              <span className="nrf-tx__frame-key">Payload</span>
              <span className="nrf-tx__frame-val">48 45 4C 4C 4F</span>
              <span className="nrf-tx__frame-decoded">"HELLO"</span>
            </div>
            <div className="nrf-tx__frame-row">
              <span className="nrf-tx__frame-key">Protocol</span>
              <span className="nrf-tx__frame-val nrf-tx__frame-val--plain">Enhanced ShockBurst</span>
            </div>
            <div className="nrf-tx__frame-row">
              <span className="nrf-tx__frame-key">Modulation</span>
              <span className="nrf-tx__frame-val nrf-tx__frame-val--plain">GFSK · 1 Mbps</span>
            </div>
            <div className="nrf-tx__frame-row nrf-tx__frame-row--accent">
              <span className="nrf-tx__frame-key">Frequency</span>
              <span className="nrf-tx__frame-val">{freqMhz}.000 MHz</span>
            </div>
          </div>
        </GlassPanel>
      </div>

      <ArmConsole
        appId="nrf24_tx"
        buildParams={() => ({
          center_hz: centerHz,
          vga_gain_db: vgaGain,
          amp_enabled: false,
        })}
        warning="own-devices-only"
        transmitLabel="TRANSMIT"
      />

      <RecordBar
        appId={"nrf24_tx" as Parameters<typeof RecordBar>[0]["appId"]}
        format="iq"
        centerHz={centerHz}
      />
    </AppScreen>
  );
}
