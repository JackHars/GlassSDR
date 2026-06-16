import { useState } from "react";
import { RecordBar } from "../../components/RecordBar";
import { AppScreen } from "../../components/kit/AppScreen";
import { ArmConsole } from "../../components/kit/ArmConsole";
import { GlassPanel } from "../../components/kit/GlassPanel";
import "./BtleTx.css";

/** BLE advertising channel definitions */
const ADV_CHANNELS = [
  { ch: 37, mhz: 2402 },
  { ch: 38, mhz: 2426 },
  { ch: 39, mhz: 2480 },
] as const;

type AdvCh = 37 | 38 | 39;

function chToMhz(ch: AdvCh): number {
  return ADV_CHANNELS.find((a) => a.ch === ch)!.mhz;
}

/** All 40 BLE channels with their MHz positions for the strip visualization. */
const ALL_BLE_CH: { ch: number; mhz: number; isAdv: boolean }[] = [
  { ch: 37, mhz: 2402, isAdv: true },
  ...Array.from({ length: 11 }, (_, i) => ({ ch: i, mhz: 2404 + i * 2, isAdv: false })),
  { ch: 38, mhz: 2426, isAdv: true },
  ...Array.from({ length: 26 }, (_, i) => ({ ch: i + 11, mhz: 2428 + i * 2, isAdv: false })),
  { ch: 39, mhz: 2480, isAdv: true },
].sort((a, b) => a.mhz - b.mhz);

const MIN_MHZ = 2400;
const MAX_MHZ = 2484;
const BAND_W = MAX_MHZ - MIN_MHZ;

function BleChannelStrip({ selectedCh, onSelect }: { selectedCh: AdvCh; onSelect: (ch: AdvCh) => void }) {
  const SVG_W = 360;
  const SVG_H = 64;
  const PAD_X = 8;
  const AXIS_Y = SVG_H - 14;
  const BAR_W_DATA = 2.2;
  const BAR_W_ADV = 5;

  const toX = (mhz: number) =>
    PAD_X + ((mhz - MIN_MHZ) / BAND_W) * (SVG_W - 2 * PAD_X);

  const axisLabels = [2400, 2420, 2440, 2460, 2480];

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      className="ble-tx__strip-svg"
      aria-label="BLE 2.4 GHz channel strip"
    >
      {/* Band background */}
      <rect
        x={PAD_X} y={12}
        width={SVG_W - 2 * PAD_X} height={AXIS_Y - 12}
        fill="rgba(72,96,232,0.05)" rx={2}
      />

      {/* ISM band label */}
      <text x={SVG_W / 2} y={10} className="ble-tx__band-label" textAnchor="middle">
        2.4 GHz ISM
      </text>

      {/* Axis line */}
      <line
        x1={PAD_X} y1={AXIS_Y}
        x2={SVG_W - PAD_X} y2={AXIS_Y}
        stroke="rgba(72,96,232,0.22)" strokeWidth={0.8}
      />

      {/* All BLE channels */}
      {ALL_BLE_CH.map(({ ch, mhz, isAdv }) => {
        const x = toX(mhz);
        const isSel = isAdv && (ch as AdvCh) === selectedCh;
        const barW = isAdv ? BAR_W_ADV : BAR_W_DATA;
        const barH = isAdv ? AXIS_Y - 18 : AXIS_Y - 28;
        const barY = AXIS_Y - barH;

        return (
          <g
            key={ch}
            onClick={isAdv ? () => onSelect(ch as AdvCh) : undefined}
            style={{ cursor: isAdv ? "pointer" : "default" }}
          >
            {isSel && (
              <rect
                x={x - barW * 1.8} y={barY - 3}
                width={barW * 3.6} height={barH + 3}
                rx={2}
                fill="rgba(72,96,232,0.18)"
              />
            )}
            <rect
              x={x - barW / 2} y={barY}
              width={barW} height={barH}
              rx={1}
              fill={
                isSel
                  ? "#4860E8"
                  : isAdv
                  ? "rgba(72,96,232,0.55)"
                  : "rgba(72,96,232,0.18)"
              }
            />
            {isAdv && (
              <text
                x={x} y={barY - 5}
                className={`ble-tx__ch-label${isSel ? " ble-tx__ch-label--sel" : ""}`}
                textAnchor="middle"
              >
                {ch}
              </text>
            )}
          </g>
        );
      })}

      {/* Axis frequency labels */}
      {axisLabels.map((mhz) => (
        <text
          key={mhz}
          x={toX(mhz)} y={SVG_H - 2}
          className="ble-tx__axis-label"
          textAnchor="middle"
        >
          {mhz}
        </text>
      ))}
    </svg>
  );
}

export function BtleTxApp() {
  const [channel, setChannel] = useState<AdvCh>(37);
  const [vgaGain, setVgaGain] = useState(20);

  const centerHz = chToMhz(channel) * 1_000_000;

  return (
    <AppScreen
      appId="btle_tx"
      title="BLE Transmitter"
      subtitle={`Ch ${channel} · ${chToMhz(channel)} MHz`}
      status="idle"
      statusText="Disarmed"
    >
      {/* 2.4 GHz channel strip hero */}
      <GlassPanel title="2.4 GHz BLE Channel Strip" pad="sm" className="ble-tx__strip-panel">
        <BleChannelStrip selectedCh={channel} onSelect={setChannel} />
        <div className="ble-tx__strip-legend">
          <span className="ble-tx__legend-item">
            <span className="ble-tx__legend-dot ble-tx__legend-dot--data" />
            Data channels (0–36)
          </span>
          <span className="ble-tx__legend-item">
            <span className="ble-tx__legend-dot ble-tx__legend-dot--adv" />
            Advertising channels (37–39) — click to select
          </span>
        </div>
      </GlassPanel>

      <div className="ble-tx__layout">
        {/* Left — channel selector + gain */}
        <GlassPanel title="Channel" size="fill" pad="md" className="ble-tx__ch-panel">
          <div className="ble-tx__ch-btns">
            {ADV_CHANNELS.map(({ ch, mhz }) => (
              <button
                key={ch}
                className={`ble-tx__ch-btn${channel === ch ? " ble-tx__ch-btn--sel" : ""}`}
                onClick={() => setChannel(ch)}
                aria-pressed={channel === ch}
              >
                <span className="ble-tx__ch-num">Ch {ch}</span>
                <span className="ble-tx__ch-mhz">{mhz} MHz</span>
              </button>
            ))}
          </div>

          <div className="ble-tx__gain-row">
            <label className="ble-tx__field-label">TX VGA · {vgaGain} dB</label>
            <input
              type="range"
              className="ble-tx__slider"
              min={0}
              max={47}
              value={vgaGain}
              onChange={(e) => setVgaGain(+e.target.value)}
            />
          </div>
        </GlassPanel>

        {/* Right — advertisement info (backend-fixed values shown as display) */}
        <GlassPanel title="Advertisement PDU" size="fill" pad="md" className="ble-tx__pdu-panel">
          <div className="ble-tx__pdu-fields">
            <div className="ble-tx__pdu-row">
              <span className="ble-tx__pdu-key">PDU Type</span>
              <span className="ble-tx__pdu-val">ADV_NONCONN_IND</span>
            </div>
            <div className="ble-tx__pdu-row">
              <span className="ble-tx__pdu-key">MAC Addr</span>
              <span className="ble-tx__pdu-val ble-tx__pdu-val--mono">
                01:02:03:04:05:06
              </span>
            </div>
            <div className="ble-tx__pdu-row">
              <span className="ble-tx__pdu-key">Adv Data</span>
              <span className="ble-tx__pdu-val ble-tx__pdu-val--mono">
                02 01 06 04 FF DE AD BE
              </span>
            </div>
            <div className="ble-tx__pdu-row">
              <span className="ble-tx__pdu-key">Modulation</span>
              <span className="ble-tx__pdu-val">GFSK · 1 Mbps</span>
            </div>
            <div className="ble-tx__pdu-row">
              <span className="ble-tx__pdu-key">Frequency</span>
              <span className="ble-tx__pdu-val ble-tx__pdu-val--mono ble-tx__pdu-val--accent">
                {chToMhz(channel)}.000 MHz
              </span>
            </div>
          </div>
        </GlassPanel>
      </div>

      <ArmConsole
        appId="btle_tx"
        buildParams={() => ({
          center_hz: centerHz,
          channel,
          vga_gain_db: vgaGain,
          amp_enabled: false,
        })}
        warning="own-devices-only"
        transmitLabel="TRANSMIT"
      />

      <RecordBar
        appId={"btle_tx" as Parameters<typeof RecordBar>[0]["appId"]}
        format="iq"
        centerHz={centerHz}
      />
    </AppScreen>
  );
}
