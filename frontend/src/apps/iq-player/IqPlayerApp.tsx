import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { startApp, stopApp } from "../../ipc/commands";
import { AppScreen, type AppStatus } from "../../components/kit/AppScreen";
import { GlassPanel } from "../../components/kit/GlassPanel";
import { RecordBar } from "../../components/RecordBar";
import { Waterfall } from "../../components/Waterfall";
import type { AppId } from "../../ipc/types/AppId";
import type { SpectrumFrame } from "../../ipc/types/SpectrumFrame";
import "./IqPlayer.css";

type IqFormat = "cs8" | "cu8" | "cs16" | "cf32";
type PlaybackSpeed = 0.25 | 0.5 | 1 | 2 | 4;

const FORMAT_OPTIONS: { value: IqFormat; label: string; sub: string }[] = [
  { value: "cs8",  label: "CS8",  sub: "HackRF" },
  { value: "cu8",  label: "CU8",  sub: "RTL-SDR" },
  { value: "cs16", label: "CS16", sub: "16-bit signed" },
  { value: "cf32", label: "CF32", sub: "32-bit float" },
];

const SPEED_OPTIONS: PlaybackSpeed[] = [0.25, 0.5, 1, 2, 4];

const DEMOD_ROUTES = [
  { id: "none",  label: "— no demod —" },
  { id: "nfm",   label: "NFM Audio" },
  { id: "wfm",   label: "Wideband FM" },
  { id: "am",    label: "AM" },
  { id: "usb",   label: "USB" },
  { id: "lsb",   label: "LSB" },
];

function fmtHz(hz: number): string {
  if (hz >= 1e9) return `${(hz / 1e9).toFixed(3)} GHz`;
  if (hz >= 1e6) return `${(hz / 1e6).toFixed(3)} MHz`;
  if (hz >= 1e3) return `${(hz / 1e3).toFixed(1)} kHz`;
  return `${hz} Hz`;
}

function baseName(path: string): string {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return i >= 0 ? path.slice(i + 1) : path;
}

// ── Transport Bar ─────────────────────────────────────────────────────────────

interface TransportBarProps {
  playing: boolean;
  speed: PlaybackSpeed;
  onPlay: () => void;
  onStop: () => void;
  onSpeedChange: (s: PlaybackSpeed) => void;
  centerHz: number;
  format: IqFormat;
}

function TransportBar({
  playing, speed, onPlay, onStop, onSpeedChange, centerHz, format
}: TransportBarProps) {
  return (
    <div className="iqp-transport">
      {/* Big play/stop button */}
      <button
        className={`iqp-transport__play${playing ? " iqp-transport__play--active" : ""}`}
        onClick={playing ? onStop : onPlay}
        aria-label={playing ? "Stop" : "Play"}
      >
        {playing ? (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect x="4" y="3" width="4.5" height="14" rx="1.5" fill="currentColor" />
            <rect x="11.5" y="3" width="4.5" height="14" rx="1.5" fill="currentColor" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M5 3.5L17 10L5 16.5V3.5Z" fill="currentColor" />
          </svg>
        )}
      </button>

      {/* Progress/scrub rail */}
      <div className="iqp-transport__rail-wrap">
        <div className="iqp-transport__rail">
          <div
            className="iqp-transport__fill"
            style={{ width: playing ? "var(--iqp-progress, 0%)" : "0%" }}
          />
          <div className="iqp-transport__thumb" style={{ left: playing ? "var(--iqp-progress, 0%)" : "0%" }} />
        </div>
        <div className="iqp-transport__time">
          <span>{playing ? "LIVE" : "00:00"}</span>
          <span className="iqp-transport__center">{fmtHz(centerHz)} · {format.toUpperCase()}</span>
          <span>—:——</span>
        </div>
      </div>

      {/* Speed control */}
      <div className="iqp-transport__speed">
        {SPEED_OPTIONS.map((s) => (
          <button
            key={s}
            className={`iqp-speed-btn${speed === s ? " iqp-speed-btn--on" : ""}`}
            onClick={() => onSpeedChange(s)}
          >
            {s}×
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function IqPlayerApp() {
  const [filePath, setFilePath]   = useState("");
  const [format, setFormat]       = useState<IqFormat>("cs8");
  const [centerHz, setCenterHz]   = useState(100_000_000);
  const [speed, setSpeed]         = useState<PlaybackSpeed>(1);
  const [demodRoute, setDemodRoute] = useState("none");
  const [playing, setPlaying]     = useState(false);
  const [spectrum, setSpectrum]   = useState<SpectrumFrame | null>(null);

  useEffect(() => {
    const ul = listen<SpectrumFrame>("spectrum", (e) => setSpectrum(e.payload));
    return () => { ul.then((f) => f()); };
  }, []);

  const handlePlay = async () => {
    if (!filePath.trim()) return;
    await startApp("iq_player" as AppId, {
      file_path: filePath,
      format,
      center_hz: centerHz,
    });
    setPlaying(true);
  };

  const handleStop = async () => {
    await stopApp();
    setPlaying(false);
  };

  const appStatus: AppStatus = playing ? "live" : "idle";
  const statusText = playing
    ? `Playing · ${format.toUpperCase()} · ${fmtHz(centerHz)} · ${speed}×`
    : filePath
    ? `Loaded · ${baseName(filePath)}`
    : "No file loaded";

  const fileLoaded = filePath.trim().length > 0;

  return (
    <AppScreen
      appId="iq_player"
      title="IQ Player"
      subtitle="RF Time Machine"
      status={appStatus}
      statusText={statusText}
      actions={
        playing ? (
          <button className="iqp-btn iqp-btn--stop" onClick={handleStop}>■ Stop</button>
        ) : (
          <button className="iqp-btn iqp-btn--play" onClick={handlePlay} disabled={!fileLoaded}>▶ Play</button>
        )
      }
      controls={
        <div className="iqp-controls">
          <div className="iqp-ctrl-field iqp-ctrl-field--format">
            <label className="iqp-ctrl-label">Format</label>
            <div className="iqp-format-tabs">
              {FORMAT_OPTIONS.map((f) => (
                <button
                  key={f.value}
                  className={`iqp-fmt-tab${format === f.value ? " iqp-fmt-tab--on" : ""}`}
                  onClick={() => setFormat(f.value)}
                >
                  <span className="iqp-fmt-tab__label">{f.label}</span>
                  <span className="iqp-fmt-tab__sub">{f.sub}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="iqp-ctrl-field">
            <label className="iqp-ctrl-label">Center Frequency (Hz)</label>
            <input
              className="iqp-ctrl-input"
              type="number"
              value={centerHz}
              step={1_000_000}
              onChange={(e) => setCenterHz(Number(e.target.value))}
            />
          </div>
          <div className="iqp-ctrl-field">
            <label className="iqp-ctrl-label">Route to Demod</label>
            <select
              className="iqp-ctrl-select"
              value={demodRoute}
              onChange={(e) => setDemodRoute(e.target.value)}
            >
              {DEMOD_ROUTES.map((d) => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
          </div>
        </div>
      }
      footer={<RecordBar appId={"iq_player" as AppId} format="iq" centerHz={centerHz} />}
    >
      <div className="iqp-layout">
        {/* File picker */}
        <GlassPanel title="IQ File" pad="sm" style={{ flexShrink: 0 }}>
          <div className="iqp-file-picker">
            <input
              className="iqp-file-input"
              type="text"
              value={filePath}
              onChange={(e) => setFilePath(e.target.value)}
              placeholder="/path/to/recording.cs8"
              spellCheck={false}
            />
            {fileLoaded && (
              <div className="iqp-file-badge">
                <span className="iqp-file-badge__name">{baseName(filePath)}</span>
                <span className="iqp-file-badge__fmt">{format.toUpperCase()}</span>
              </div>
            )}
          </div>
        </GlassPanel>

        {/* Waterfall — driven by spectrum events during playback */}
        <GlassPanel
          title="Spectrum"
          titleRight={playing ? <span className="iqp-live-badge">▶ playback</span> : undefined}
          size="fill"
          pad="none"
        >
          {spectrum && playing ? (
            <Waterfall
              frame={spectrum}
              centerHz={centerHz}
              spanHz={spectrum.span_hz}
              height={180}
            />
          ) : (
            <div className="iqp-waterfall-idle">
              <div className="iqp-wf-idle-inner">
                {/* Stylized idle waveform */}
                <svg width="200" height="48" viewBox="0 0 200 48" fill="none" className="iqp-idle-wave">
                  <polyline
                    points="0,24 20,24 25,8 30,40 35,8 40,40 45,24 65,24 70,10 75,38 80,10 85,38 90,24 110,24 115,12 120,36 125,12 130,36 135,24 155,24 160,8 165,40 170,8 175,40 180,24 200,24"
                    stroke="rgba(0,180,204,0.3)"
                    strokeWidth="1.5"
                    fill="none"
                  />
                </svg>
                <span className="iqp-wf-idle-text">
                  {fileLoaded ? "Press Play to begin playback" : "Load an IQ file to begin"}
                </span>
              </div>
            </div>
          )}
        </GlassPanel>

        {/* Transport bar — the hero */}
        <GlassPanel title="Transport" accent pad="sm" style={{ flexShrink: 0 }}>
          <TransportBar
            playing={playing}
            speed={speed}
            onPlay={handlePlay}
            onStop={handleStop}
            onSpeedChange={setSpeed}
            centerHz={centerHz}
            format={format}
          />
        </GlassPanel>
      </div>
    </AppScreen>
  );
}
