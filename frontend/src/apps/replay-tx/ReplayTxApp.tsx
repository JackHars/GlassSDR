import { useState } from "react";
import { RecordBar } from "../../components/RecordBar";
import { AppScreen } from "../../components/kit/AppScreen";
import { ArmConsole } from "../../components/kit/ArmConsole";
import { GlassPanel } from "../../components/kit/GlassPanel";
import { useStore } from "../../store";
import "./ReplayTx.css";

/** Deterministic pseudo-noise waveform for the IQ preview — looks like real I/Q data. */
function makeWaveform(seed: number, count: number): number[] {
  const out: number[] = [];
  let s = seed | 1;
  for (let i = 0; i < count; i++) {
    s = (s ^ (s << 13)) & 0x7fff;
    s = (s ^ (s >> 7)) & 0x7fff;
    s = (s ^ (s << 17)) & 0x7fff;
    // Blend noise with a slow sine for a more IQ-like look
    const base = Math.sin(i * 0.28 + s * 0.0001) * 0.45;
    out.push(base + ((s & 0xfff) / 0xfff - 0.5) * 0.55);
  }
  return out;
}

const WAVE_BARS = 80;
const BASE_SEED = 0x5a3f;

function TapeTransport({ filePath, progress }: { filePath: string; progress: number | undefined }) {
  const seed = filePath
    ? filePath.split("").reduce((a, c) => a ^ (c.charCodeAt(0) * 31), BASE_SEED)
    : BASE_SEED;

  const iWave = makeWaveform(seed, WAVE_BARS);
  const qWave = makeWaveform(seed ^ 0xf1e2, WAVE_BARS);

  const hasFile = filePath.trim().length > 0;
  const playPct = progress ?? 0;

  // SVG reel helpers
  const REEL_R = 20;
  const TAPE_Y = 30;

  return (
    <div className="replay-tx__transport">
      {/* Dual-reel cassette visualization */}
      <svg viewBox="0 0 200 64" className="replay-tx__reels-svg" aria-hidden="true">
        {/* Left reel */}
        <circle cx={32} cy={32} r={REEL_R} fill="rgba(200,80,0,0.10)" stroke="rgba(200,80,0,0.30)" strokeWidth={1} />
        <circle cx={32} cy={32} r={REEL_R * 0.5} fill="rgba(200,80,0,0.18)" stroke="rgba(200,80,0,0.25)" strokeWidth={0.8} />
        <circle cx={32} cy={32} r={4} fill="rgba(200,80,0,0.45)" />
        {/* Left reel spokes */}
        {[0, 60, 120, 180, 240, 300].map((deg) => {
          const rad = (deg * Math.PI) / 180;
          return (
            <line
              key={deg}
              x1={32 + Math.cos(rad) * 6}
              y1={32 + Math.sin(rad) * 6}
              x2={32 + Math.cos(rad) * REEL_R * 0.85}
              y2={32 + Math.sin(rad) * REEL_R * 0.85}
              stroke="rgba(200,80,0,0.35)"
              strokeWidth={0.8}
              className={hasFile ? "replay-tx__spoke replay-tx__spoke--spin" : "replay-tx__spoke"}
            />
          );
        })}

        {/* Tape path */}
        <path
          d={`M ${32 + REEL_R - 1} ${TAPE_Y} L ${200 - 32 - REEL_R + 1} ${TAPE_Y}`}
          fill="none"
          stroke="rgba(200,80,0,0.22)"
          strokeWidth={6}
        />
        <path
          d={`M ${32 + REEL_R - 1} ${TAPE_Y + 4} L ${200 - 32 - REEL_R + 1} ${TAPE_Y + 4}`}
          fill="none"
          stroke="rgba(200,80,0,0.10)"
          strokeWidth={1}
        />

        {/* Right reel */}
        <circle cx={168} cy={32} r={REEL_R} fill="rgba(200,80,0,0.10)" stroke="rgba(200,80,0,0.30)" strokeWidth={1} />
        <circle cx={168} cy={32} r={REEL_R * 0.5} fill="rgba(200,80,0,0.18)" stroke="rgba(200,80,0,0.25)" strokeWidth={0.8} />
        <circle cx={168} cy={32} r={4} fill="rgba(200,80,0,0.45)" />
        {[0, 60, 120, 180, 240, 300].map((deg) => {
          const rad = (deg * Math.PI) / 180;
          return (
            <line
              key={deg}
              x1={168 + Math.cos(rad) * 6}
              y1={32 + Math.sin(rad) * 6}
              x2={168 + Math.cos(rad) * REEL_R * 0.85}
              y2={32 + Math.sin(rad) * REEL_R * 0.85}
              stroke="rgba(200,80,0,0.35)"
              strokeWidth={0.8}
              className={hasFile && (progress ?? 0) > 0 ? "replay-tx__spoke replay-tx__spoke--spin-rev" : "replay-tx__spoke"}
            />
          );
        })}

        {/* Progress fill over tape */}
        {hasFile && (
          <rect
            x={32 + REEL_R - 1}
            y={TAPE_Y - 2}
            width={((200 - 64 - 2) * playPct) / 100}
            height={8}
            fill="rgba(200,80,0,0.45)"
            rx={1}
          />
        )}
      </svg>

      {/* IQ waveform strip */}
      <div className="replay-tx__waveform" aria-label="IQ waveform preview">
        <svg viewBox={`0 0 ${WAVE_BARS * 3} 48`} className="replay-tx__wave-svg" preserveAspectRatio="none">
          {/* I channel */}
          <polyline
            points={iWave
              .map((v, i) => `${i * 3 + 1.5},${12 - v * 10}`)
              .join(" ")}
            fill="none"
            stroke={hasFile ? "rgba(200,80,0,0.70)" : "rgba(200,80,0,0.25)"}
            strokeWidth={1}
          />
          {/* Q channel */}
          <polyline
            points={qWave
              .map((v, i) => `${i * 3 + 1.5},${36 - v * 10}`)
              .join(" ")}
            fill="none"
            stroke={hasFile ? "rgba(200,80,0,0.45)" : "rgba(200,80,0,0.15)"}
            strokeWidth={1}
          />
          {/* Playhead */}
          {hasFile && playPct > 0 && (
            <line
              x1={(WAVE_BARS * 3 * playPct) / 100}
              y1={0}
              x2={(WAVE_BARS * 3 * playPct) / 100}
              y2={48}
              stroke="rgba(200,80,0,0.85)"
              strokeWidth={1.5}
            />
          )}
        </svg>
        <div className="replay-tx__wave-labels">
          <span className="replay-tx__wave-ch">I</span>
          <span className="replay-tx__wave-ch replay-tx__wave-ch--q">Q</span>
        </div>
      </div>

      {/* No-file empty state */}
      {!hasFile && (
        <div className="replay-tx__empty">No capture loaded — enter a file path above</div>
      )}
    </div>
  );
}

export function ReplayTxApp() {
  const [filePath, setFilePath] = useState("");
  const [frequency, setFrequency] = useState("");
  const { txStatus } = useStore();

  const freqNum = parseFloat(frequency) || 0;
  const progress =
    txStatus?.kind === "transmitting" ? txStatus.progress_pct : undefined;

  return (
    <AppScreen
      appId="replay_tx"
      title="Replay Transmitter"
      subtitle="IQ capture · replay"
      status="idle"
      statusText="Disarmed"
    >
      {/* File picker */}
      <GlassPanel title="Capture File" pad="sm" className="replay-tx__file-panel">
        <div className="replay-tx__file-row">
          <span className="replay-tx__file-icon">◈</span>
          <input
            className="replay-tx__file-input"
            type="text"
            value={filePath}
            placeholder="/path/to/recording.cf32"
            spellCheck={false}
            onChange={(e) => setFilePath(e.target.value)}
          />
          {filePath && (
            <button
              className="replay-tx__file-clear"
              onClick={() => setFilePath("")}
              aria-label="Clear file"
            >
              ×
            </button>
          )}
        </div>
      </GlassPanel>

      <div className="replay-tx__layout">
        {/* Left — transport hero */}
        <GlassPanel title="Transport" size="fill" pad="sm" className="replay-tx__transport-panel">
          <TapeTransport filePath={filePath} progress={progress} />
        </GlassPanel>

        {/* Right — params */}
        <GlassPanel title="Replay Config" size="fill" pad="md" className="replay-tx__config-panel">
          <div className="replay-tx__field-stack">
            <div className="replay-tx__field">
              <label className="replay-tx__field-label">Replay Frequency</label>
              <div className="replay-tx__input-wrap">
                <input
                  className="replay-tx__input"
                  type="number"
                  value={frequency}
                  placeholder="e.g. 433920000"
                  onChange={(e) => setFrequency(e.target.value)}
                />
                <span className="replay-tx__input-suffix">Hz</span>
              </div>
              {freqNum > 0 && (
                <span className="replay-tx__field-sub">
                  {(freqNum / 1e6).toFixed(4)} MHz
                </span>
              )}
            </div>

            <div className="replay-tx__format-row">
              <span className="replay-tx__format-key">Format</span>
              <span className="replay-tx__format-val">cf32</span>
              <span className="replay-tx__format-sep">·</span>
              <span className="replay-tx__format-key">Rate</span>
              <span className="replay-tx__format-val">2 Msps</span>
            </div>
          </div>
        </GlassPanel>
      </div>

      <ArmConsole
        appId="replay_tx"
        buildParams={() => ({
          center_hz: freqNum,
          file_path: filePath,
          vga_gain_db: 20,
          amp_enabled: false,
        })}
        warning="own-devices-only"
        transmitLabel="REPLAY"
      />

      <RecordBar
        appId={"replay_tx" as Parameters<typeof RecordBar>[0]["appId"]}
        format="iq"
        centerHz={freqNum || undefined}
      />
    </AppScreen>
  );
}
