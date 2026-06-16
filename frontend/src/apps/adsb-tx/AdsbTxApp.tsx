import { useState, useMemo } from "react";
import { RecordBar } from "../../components/RecordBar";
import { AppScreen } from "../../components/kit/AppScreen";
import { ArmConsole } from "../../components/kit/ArmConsole";
import { GlassPanel } from "../../components/kit/GlassPanel";
import "./AdsbTx.css";

/** Simplified world map outline points (lat/lon) for major continental shapes */
const SVG_W = 300;
const SVG_H = 150;
const PAD = 16;
const MAP_W = SVG_W - 2 * PAD;
const MAP_H = SVG_H - 2 * PAD;

function toSvgX(lon: number) {
  return PAD + ((lon + 180) / 360) * MAP_W;
}
function toSvgY(lat: number) {
  return PAD + ((90 - lat) / 180) * MAP_H;
}

const GRID_LATS = [-60, -30, 0, 30, 60];
const GRID_LONS = [-120, -60, 0, 60, 120];

function PhantomAircraftMap({
  lat,
  lon,
  icao24,
  altFt,
}: {
  lat: number;
  lon: number;
  icao24: string;
  altFt: number;
}) {
  const isValid = lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
  const ax = toSvgX(lon);
  const ay = toSvgY(lat);

  return (
    <div className="adsb-tx__map-wrap">
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        className="adsb-tx__map-svg"
        aria-label="Phantom aircraft position preview"
      >
        {/* Map background */}
        <rect
          x={PAD} y={PAD}
          width={MAP_W} height={MAP_H}
          fill="rgba(10,20,40,0.5)"
          rx={3}
        />

        {/* Latitude grid lines */}
        {GRID_LATS.map((latLine) => {
          const yLine = toSvgY(latLine);
          const isEquator = latLine === 0;
          return (
            <line
              key={`lat${latLine}`}
              x1={PAD} y1={yLine}
              x2={SVG_W - PAD} y2={yLine}
              stroke={isEquator ? "rgba(192,120,0,0.35)" : "rgba(192,120,0,0.18)"}
              strokeWidth={isEquator ? 0.8 : 0.5}
            />
          );
        })}

        {/* Longitude grid lines */}
        {GRID_LONS.map((lonLine) => {
          const xLine = toSvgX(lonLine);
          const isPrime = lonLine === 0;
          return (
            <line
              key={`lon${lonLine}`}
              x1={xLine} y1={PAD}
              x2={xLine} y2={SVG_H - PAD}
              stroke={isPrime ? "rgba(192,120,0,0.35)" : "rgba(192,120,0,0.18)"}
              strokeWidth={isPrime ? 0.8 : 0.5}
            />
          );
        })}

        {/* Map border */}
        <rect
          x={PAD} y={PAD}
          width={MAP_W} height={MAP_H}
          fill="none"
          stroke="rgba(192,120,0,0.28)"
          strokeWidth={1}
          rx={3}
        />

        {/* Corner coordinate labels */}
        <text x={PAD + 3} y={PAD + 8} className="adsb-tx__map-label">90°N</text>
        <text x={PAD + 3} y={SVG_H - PAD - 2} className="adsb-tx__map-label">90°S</text>
        <text x={PAD + 3} y={toSvgY(0) + 1} className="adsb-tx__map-label" dominantBaseline="middle">0°</text>

        {/* Phantom aircraft marker */}
        {isValid && (
          <g transform={`translate(${ax},${ay})`} className="adsb-tx__aircraft-marker">
            {/* Pulse ring */}
            <circle r={11} className="adsb-tx__pulse-ring" />
            {/* Inner glow */}
            <circle r={6} fill="rgba(192,120,0,0.25)" />
            {/* Aircraft silhouette (pointing north) */}
            <path
              d="M0,-6 L2.5,2 L0,0.5 L-2.5,2 Z"
              fill="#C07800"
              stroke="rgba(255,200,80,0.9)"
              strokeWidth={0.6}
              strokeLinejoin="round"
            />
            {/* ICAO label */}
            <text
              x={9} y={4}
              className="adsb-tx__icao-label"
            >
              {icao24.toUpperCase().slice(0, 6)}
            </text>
          </g>
        )}
      </svg>

      {/* Coordinate readout strip */}
      <div className="adsb-tx__coord-strip">
        <span className="adsb-tx__coord-item">
          <span className="adsb-tx__coord-key">LAT</span>
          <span className="adsb-tx__coord-val">{lat.toFixed(4)}°</span>
        </span>
        <span className="adsb-tx__coord-dot">·</span>
        <span className="adsb-tx__coord-item">
          <span className="adsb-tx__coord-key">LON</span>
          <span className="adsb-tx__coord-val">{lon.toFixed(4)}°</span>
        </span>
        <span className="adsb-tx__coord-dot">·</span>
        <span className="adsb-tx__coord-item">
          <span className="adsb-tx__coord-key">ALT</span>
          <span className="adsb-tx__coord-val">{altFt.toLocaleString()} ft</span>
        </span>
      </div>
    </div>
  );
}

export function AdsbTxApp() {
  const [icao24, setIcao24] = useState("ABCDEF");
  const [lat, setLat] = useState("0.0");
  const [lon, setLon] = useState("0.0");
  const [altFt, setAltFt] = useState("35000");
  const [vgaGain, setVgaGain] = useState(20);

  const latNum = useMemo(() => {
    const v = parseFloat(lat);
    return isNaN(v) ? 0 : Math.max(-90, Math.min(90, v));
  }, [lat]);
  const lonNum = useMemo(() => {
    const v = parseFloat(lon);
    return isNaN(v) ? 0 : Math.max(-180, Math.min(180, v));
  }, [lon]);
  const altNum = useMemo(() => parseInt(altFt, 10) || 0, [altFt]);

  return (
    <AppScreen
      appId="adsb_tx"
      title="ADS-B Spoofer"
      subtitle="1090 MHz · PPM"
      status="idle"
      statusText="Disarmed"
    >
      <div className="adsb-tx__layout">
        {/* Left column — phantom parameters */}
        <GlassPanel title="Phantom Parameters" size="fill" pad="md" className="adsb-tx__params-panel">
          <div className="adsb-tx__field-grid">
            <div className="adsb-tx__field">
              <label className="adsb-tx__field-label">ICAO24</label>
              <div className="adsb-tx__input-wrap">
                <input
                  className="adsb-tx__input"
                  value={icao24}
                  maxLength={6}
                  placeholder="ABCDEF"
                  spellCheck={false}
                  onChange={(e) =>
                    setIcao24(e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6))
                  }
                />
                <span className="adsb-tx__input-hint">hex</span>
              </div>
            </div>

            <div className="adsb-tx__field">
              <label className="adsb-tx__field-label">Altitude</label>
              <div className="adsb-tx__input-wrap">
                <input
                  className="adsb-tx__input"
                  type="number"
                  value={altFt}
                  min={-1500}
                  max={60000}
                  step={100}
                  onChange={(e) => setAltFt(e.target.value)}
                />
                <span className="adsb-tx__input-hint">ft</span>
              </div>
            </div>

            <div className="adsb-tx__field">
              <label className="adsb-tx__field-label">Latitude</label>
              <div className="adsb-tx__input-wrap">
                <input
                  className="adsb-tx__input"
                  type="number"
                  value={lat}
                  min={-90}
                  max={90}
                  step={0.001}
                  onChange={(e) => setLat(e.target.value)}
                />
                <span className="adsb-tx__input-hint">°</span>
              </div>
            </div>

            <div className="adsb-tx__field">
              <label className="adsb-tx__field-label">Longitude</label>
              <div className="adsb-tx__input-wrap">
                <input
                  className="adsb-tx__input"
                  type="number"
                  value={lon}
                  min={-180}
                  max={180}
                  step={0.001}
                  onChange={(e) => setLon(e.target.value)}
                />
                <span className="adsb-tx__input-hint">°</span>
              </div>
            </div>

            <div className="adsb-tx__field adsb-tx__field--full">
              <label className="adsb-tx__field-label">TX VGA Gain · {vgaGain} dB</label>
              <input
                type="range"
                className="adsb-tx__slider"
                min={0}
                max={47}
                value={vgaGain}
                onChange={(e) => setVgaGain(+e.target.value)}
              />
            </div>
          </div>
        </GlassPanel>

        {/* Right column — position preview */}
        <GlassPanel title="Position Preview" size="fill" pad="sm" className="adsb-tx__preview-panel">
          <PhantomAircraftMap
            lat={latNum}
            lon={lonNum}
            icao24={icao24 || "??????"}
            altFt={altNum}
          />
        </GlassPanel>
      </div>

      {/* Arm / transmit gate */}
      <ArmConsole
        appId="adsb_tx"
        buildParams={() => ({
          center_hz: 1_090_000_000,
          icao24: parseInt(icao24, 16) || 0,
          lat: latNum,
          lon: lonNum,
          alt_ft: altNum,
          vga_gain_db: vgaGain,
          amp_enabled: false,
        })}
        warning="indoor-only"
        transmitLabel="SPOOF"
      />

      <RecordBar
        appId={"adsb_tx" as Parameters<typeof RecordBar>[0]["appId"]}
        format="iq"
        centerHz={1_090_000_000}
      />
    </AppScreen>
  );
}
