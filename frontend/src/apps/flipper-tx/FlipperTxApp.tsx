import { useState, useRef, useCallback } from "react";
import { RecordBar } from "../../components/RecordBar";
import { AppScreen } from "../../components/kit/AppScreen";
import { ArmConsole } from "../../components/kit/ArmConsole";
import { GlassPanel } from "../../components/kit/GlassPanel";
import "./FlipperTx.css";

interface SubFile {
  frequency: number;
  preset: string;
  protocol: string;
  rawData: number[];
}

function parseSubFile(content: string): SubFile | null {
  const trimmed = content.trim();
  if (!trimmed.includes("Flipper SubGhz") && !trimmed.includes("SubGhz")) {
    return null;
  }

  const get = (key: string): string => {
    const match = content.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
    return match ? match[1].trim() : "";
  };

  const freqStr = get("Frequency");
  const frequency = parseFloat(freqStr) || 433_920_000;
  const rawStr = get("RAW_Data");
  const rawData = rawStr
    ? rawStr.split(/\s+/).map(Number).filter((n) => !isNaN(n) && n !== 0)
    : [];

  return {
    frequency,
    preset: get("Preset") || get("Modulation") || "Unknown",
    protocol: get("Protocol") || "RAW",
    rawData,
  };
}

const EXAMPLE_SUB = `Filetype: Flipper SubGhz RAW File
Version: 1
Frequency: 433920000
Preset: FuriHalSubGhzPresetOok650Async
Protocol: RAW
RAW_Data: 400 -400 400 -400 800 -800 400 -400 400 -1200 800 -400 400 -400 400 -400 800 -800 400 -400`;

/** Renders a mini square-wave from RAW_Data timing values. */
function PulseWaveform({ rawData }: { rawData: number[] }) {
  if (rawData.length === 0) return null;

  const preview = rawData.slice(0, 60);
  const total = preview.reduce((s, v) => s + Math.abs(v), 0);
  if (total === 0) return null;

  const W = 320;
  const H = 32;
  const MID = H / 2;
  const AMP = 11;

  let x = 0;
  const pts: string[] = [`0,${MID}`];

  preview.forEach((v) => {
    const isHi = v > 0;
    const w = (Math.abs(v) / total) * W;
    pts.push(`${x},${isHi ? MID - AMP : MID + AMP}`);
    x += w;
    pts.push(`${x},${isHi ? MID - AMP : MID + AMP}`);
  });
  pts.push(`${W},${MID}`);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="flipper-tx__wave-svg" aria-label="Pulse waveform">
      <line x1={0} y1={MID} x2={W} y2={MID} stroke="rgba(192,88,136,0.15)" strokeWidth={0.5} />
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke="rgba(192,88,136,0.80)"
        strokeWidth={1.2}
        strokeLinejoin="miter"
      />
    </svg>
  );
}

export function FlipperTxApp() {
  const [subContent, setSubContent] = useState("");
  const [vgaGain, setVgaGain] = useState(20);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parsed = subContent ? parseSubFile(subContent) : null;
  const centerHz = parsed?.frequency ?? 433_920_000;

  const loadFile = useCallback((file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) setSubContent(text);
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) loadFile(file);
    },
    [loadFile]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const presetShort = parsed?.preset
    .replace("FuriHalSubGhzPreset", "")
    .replace("Async", "")
    || "—";

  return (
    <AppScreen
      appId="flipper_tx"
      title="Flipper Sub-GHz"
      subtitle=".sub file replay"
      status={parsed ? "acquiring" : "idle"}
      statusText={parsed ? "Capture loaded" : "No capture"}
    >
      {/* Dropzone hero */}
      <GlassPanel title=".sub Capture File" pad="sm" className="flipper-tx__drop-panel">
        <div
          className={`flipper-tx__dropzone${isDragging ? " flipper-tx__dropzone--drag" : ""}${parsed ? " flipper-tx__dropzone--loaded" : ""}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={() => setIsDragging(false)}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label="Drop .sub file or click to browse"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".sub,text/*"
            className="flipper-tx__file-input-hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) loadFile(file);
              e.target.value = "";
            }}
          />

          {!parsed ? (
            <>
              <span className="flipper-tx__drop-icon">🐬</span>
              <span className="flipper-tx__drop-primary">
                Drop a <code>.sub</code> file here or click to browse
              </span>
              <span className="flipper-tx__drop-secondary">
                Flipper Zero Sub-GHz RAW capture
              </span>
            </>
          ) : (
            <div className="flipper-tx__loaded-row">
              <span className="flipper-tx__loaded-icon">✓</span>
              <span className="flipper-tx__loaded-text">
                Capture loaded · {(centerHz / 1e6).toFixed(3)} MHz ·{" "}
                {parsed.rawData.length} pulses
              </span>
              <button
                className="flipper-tx__clear-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setSubContent("");
                }}
                aria-label="Clear capture"
              >
                ×
              </button>
            </div>
          )}
        </div>
      </GlassPanel>

      {/* Parsed capture summary */}
      {parsed ? (
        <GlassPanel title="Capture Summary" pad="md" className="flipper-tx__summary-panel">
          <div className="flipper-tx__summary-grid">
            <div className="flipper-tx__summary-field">
              <span className="flipper-tx__summary-key">Frequency</span>
              <span className="flipper-tx__summary-val">
                {(parsed.frequency / 1e6).toFixed(3)} MHz
              </span>
            </div>
            <div className="flipper-tx__summary-field">
              <span className="flipper-tx__summary-key">Protocol</span>
              <span className="flipper-tx__summary-val">{parsed.protocol}</span>
            </div>
            <div className="flipper-tx__summary-field">
              <span className="flipper-tx__summary-key">Preset</span>
              <span className="flipper-tx__summary-val">{presetShort}</span>
            </div>
            <div className="flipper-tx__summary-field">
              <span className="flipper-tx__summary-key">Pulses</span>
              <span className="flipper-tx__summary-val">
                {parsed.rawData.length.toLocaleString()}
              </span>
            </div>
          </div>
          {parsed.rawData.length > 0 && (
            <div className="flipper-tx__wave-wrap">
              <span className="flipper-tx__wave-label">Pulse train preview</span>
              <PulseWaveform rawData={parsed.rawData} />
            </div>
          )}
        </GlassPanel>
      ) : (
        <GlassPanel pad="md" className="flipper-tx__example-panel">
          <div className="flipper-tx__example-header">
            <span className="flipper-tx__example-label">Example .sub format</span>
            <button
              className="flipper-tx__example-load"
              onClick={() => setSubContent(EXAMPLE_SUB)}
            >
              Load example
            </button>
          </div>
          <pre className="flipper-tx__example-pre">{EXAMPLE_SUB}</pre>
        </GlassPanel>
      )}

      <div className="flipper-tx__gain-row">
        <label className="flipper-tx__field-label">TX VGA · {vgaGain} dB</label>
        <input
          type="range"
          className="flipper-tx__slider"
          min={0}
          max={47}
          value={vgaGain}
          onChange={(e) => setVgaGain(+e.target.value)}
        />
      </div>

      <ArmConsole
        appId="flipper_tx"
        buildParams={() => ({
          center_hz: centerHz,
          sub_content: subContent,
          vga_gain_db: vgaGain,
          amp_enabled: false,
        })}
        warning="own-devices-only"
        transmitLabel="REPLAY"
      />

      <RecordBar
        appId={"flipper_tx" as Parameters<typeof RecordBar>[0]["appId"]}
        format="iq"
        centerHz={centerHz}
      />
    </AppScreen>
  );
}
