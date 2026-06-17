import { useState } from "react";
import { RecordBar } from "../../components/RecordBar";
import { AppScreen } from "../../components/kit/AppScreen";
import { ArmConsole } from "../../components/kit/ArmConsole";
import { GlassPanel } from "../../components/kit/GlassPanel";
import "./GpsSim.css";

/** Fixed simulated GPS skyplot positions (azimuth °, elevation °) for PRN 1–32.
 *  These are illustrative positions, not live ephemeris. */
const GPS_SVS: { prn: number; az: number; el: number }[] = [
  { prn: 1,  az: 15,  el: 45 }, { prn: 2,  az: 75,  el: 30 },
  { prn: 3,  az: 145, el: 60 }, { prn: 4,  az: 220, el: 20 },
  { prn: 5,  az: 290, el: 55 }, { prn: 6,  az: 330, el: 35 },
  { prn: 7,  az: 50,  el: 70 }, { prn: 8,  az: 180, el: 80 },
  { prn: 9,  az: 110, el: 40 }, { prn: 10, az: 250, el: 65 },
  { prn: 11, az: 30,  el: 15 }, { prn: 12, az: 160, el: 50 },
  { prn: 13, az: 310, el: 25 }, { prn: 14, az: 200, el: 45 },
  { prn: 15, az: 85,  el: 55 }, { prn: 16, az: 270, el: 35 },
  { prn: 17, az: 135, el: 75 }, { prn: 18, az: 355, el: 42 },
  { prn: 19, az: 45,  el: 25 }, { prn: 20, az: 235, el: 58 },
  { prn: 21, az: 185, el: 28 }, { prn: 22, az: 95,  el: 48 },
  { prn: 23, az: 325, el: 62 }, { prn: 24, az: 155, el: 38 },
  { prn: 25, az: 10,  el: 68 }, { prn: 26, az: 260, el: 22 },
  { prn: 27, az: 120, el: 32 }, { prn: 28, az: 300, el: 50 },
  { prn: 29, az: 65,  el: 42 }, { prn: 30, az: 215, el: 72 },
  { prn: 31, az: 170, el: 15 }, { prn: 32, az: 340, el: 55 },
];

const CX = 90;
const CY = 90;
const R = 72; // outer ring radius (horizon)

function svToSvg(az: number, el: number) {
  const r = ((90 - el) / 90) * R;
  const θ = ((az - 90) * Math.PI) / 180; // rotate so 0° az = top
  return { x: CX + r * Math.cos(θ), y: CY + r * Math.sin(θ) };
}

function GpsSkyplot({ selectedPrn }: { selectedPrn: number }) {
  return (
    <div className="gps-sim__skyplot-wrap">
      <svg viewBox="0 0 180 180" className="gps-sim__skyplot-svg" aria-label="GPS constellation skyplot">
        {/* Background */}
        <circle cx={CX} cy={CY} r={R + 4} fill="rgba(10,18,36,0.55)" />

        {/* Elevation rings */}
        {[R, R * (45 / 90), R * (20 / 90)].map((r, i) => (
          <circle
            key={`ring${i}`}
            cx={CX} cy={CY} r={r}
            fill="none"
            stroke="rgba(184,136,0,0.22)"
            strokeWidth={0.6}
            strokeDasharray={i === 0 ? "none" : "3 3"}
          />
        ))}

        {/* Crosshair */}
        <line x1={CX - R - 4} y1={CY} x2={CX + R + 4} y2={CY} stroke="rgba(184,136,0,0.30)" strokeWidth={0.7} />
        <line x1={CX} y1={CY - R - 4} x2={CX} y2={CY + R + 4} stroke="rgba(184,136,0,0.30)" strokeWidth={0.7} />

        {/* Cardinal labels */}
        {[
          { label: "N", x: CX, y: CY - R - 7 },
          { label: "S", x: CX, y: CY + R + 11 },
          { label: "E", x: CX + R + 8, y: CY + 3 },
          { label: "W", x: CX - R - 8, y: CY + 3 },
        ].map(({ label, x, y }) => (
          <text key={label} x={x} y={y} className="gps-sim__cardinal" textAnchor="middle">{label}</text>
        ))}

        {/* Zenith dot */}
        <circle cx={CX} cy={CY} r={2} fill="rgba(184,136,0,0.4)" />

        {/* Elevation ring labels */}
        <text x={CX + 4} y={CY - R * (45 / 90) - 2} className="gps-sim__el-label">45°</text>
        <text x={CX + 4} y={CY - R + 3} className="gps-sim__el-label">0°</text>

        {/* SV markers */}
        {GPS_SVS.map(({ prn, az, el }) => {
          const { x, y } = svToSvg(az, el);
          const isSelected = prn === selectedPrn;
          return (
            <g key={prn} transform={`translate(${x},${y})`}>
              {isSelected && (
                <>
                  <circle r={9} className="gps-sim__sv-pulse" />
                  <circle r={6} fill="rgba(184,136,0,0.25)" />
                </>
              )}
              <circle
                r={isSelected ? 4.5 : 3}
                fill={isSelected ? "#B88800" : "rgba(184,136,0,0.45)"}
                stroke={isSelected ? "rgba(255,220,100,0.9)" : "rgba(184,136,0,0.4)"}
                strokeWidth={isSelected ? 0.8 : 0.5}
              />
              <text
                x={isSelected ? 6 : 5}
                y={isSelected ? -5 : -4}
                className={`gps-sim__prn-label${isSelected ? " gps-sim__prn-label--sel" : ""}`}
                textAnchor="middle"
              >
                G{prn}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="gps-sim__skyplot-legend">
        <span className="gps-sim__legend-item">
          <span className="gps-sim__legend-dot gps-sim__legend-dot--sv" />
          SV in view
        </span>
        <span className="gps-sim__legend-item">
          <span className="gps-sim__legend-dot gps-sim__legend-dot--sel" />
          Simulated PRN
        </span>
      </div>
    </div>
  );
}

export function GpsSimApp() {
  const [prn, setPrn] = useState(1);
  const [vgaGain, setVgaGain] = useState(20);

  return (
    <AppScreen
      appId="gps_sim"
      title="GPS Simulator"
      subtitle="1575.42 MHz · L1 C/A"
      status="idle"
      statusText="Disarmed"
    >
      <div className="gps-sim__layout">
        {/* Left — controls */}
        <GlassPanel title="Satellite Config" size="fill" pad="md" className="gps-sim__controls-panel">
          <div className="gps-sim__field-stack">
            <div className="gps-sim__field">
              <label className="gps-sim__field-label">PRN Number</label>
              <div className="gps-sim__prn-row">
                <input
                  className="gps-sim__input"
                  type="number"
                  value={prn}
                  min={1}
                  max={32}
                  step={1}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!isNaN(v) && v >= 1 && v <= 32) setPrn(v);
                  }}
                />
                <span className="gps-sim__prn-badge">G{String(prn).padStart(2, "0")}</span>
              </div>
              <span className="gps-sim__field-hint">GPS PRN 1 – 32</span>
            </div>

            <div className="gps-sim__prn-grid">
              {Array.from({ length: 32 }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  className={`gps-sim__prn-btn${p === prn ? " gps-sim__prn-btn--sel" : ""}`}
                  onClick={() => setPrn(p)}
                  aria-pressed={p === prn}
                >
                  {p}
                </button>
              ))}
            </div>

            <div className="gps-sim__field">
              <label className="gps-sim__field-label">TX VGA Gain · {vgaGain} dB</label>
              <input
                type="range"
                className="gps-sim__slider"
                min={0}
                max={47}
                value={vgaGain}
                onChange={(e) => setVgaGain(+e.target.value)}
              />
            </div>

            <div className="gps-sim__freq-row">
              <span className="gps-sim__freq-label">Frequency</span>
              <span className="gps-sim__freq-val">1575.42 MHz</span>
              <span className="gps-sim__freq-sub">GPS L1</span>
            </div>
          </div>
        </GlassPanel>

        {/* Right — skyplot hero */}
        <GlassPanel title="Constellation Skyplot" size="fill" pad="sm" className="gps-sim__skyplot-panel">
          <GpsSkyplot selectedPrn={prn} />
        </GlassPanel>
      </div>

      <ArmConsole
        appId="gps_sim"
        buildParams={() => ({
          center_hz: 1_575_420_000,
          prn,
          vga_gain_db: vgaGain,
          amp_enabled: false,
        })}
        warning="indoor-only"
        warningText="SHIELDED USE ONLY — GPS jamming/spoofing is a federal offense. Use only inside a calibrated RF shielded enclosure."
        transmitLabel="SIMULATE"
      />

      <RecordBar
        appId={"gps_sim" as Parameters<typeof RecordBar>[0]["appId"]}
        format="iq"
        centerHz={1_575_420_000}
      />
    </AppScreen>
  );
}
