import { useRef, useEffect, useState, useCallback } from "react";
import "./ProgressiveImage.css";

interface ProgressiveImageProps {
  /** Width of the image in pixels (e.g. 2080 for APT, 1024 for LRPT) */
  imageWidth: number;
  /** Array of scanlines, each as a Uint8Array of RGBA bytes (length = imageWidth * 4).
      Lines are provided in order: index 0 = top line. */
  scanlines: Uint8Array[];
  /** Show the scanline motif overlay (subtle horizontal lines) */
  scanlineMotif?: boolean;
  /** Label shown in the top-left badge */
  label?: string;
  /** Pass count or telemetry badge text */
  badge?: string;
  style?: React.CSSProperties;
}

/**
 * Top-down progressive line-painting canvas for satellite imagery.
 * Used by APT, HRPT, LRPT, SSTV-RX preview, and ProgressiveImage-based
 * imaging apps. Paints scanlines one at a time as they arrive.
 */
export function ProgressiveImage({
  imageWidth,
  scanlines,
  scanlineMotif = true,
  label,
  badge,
  style,
}: ProgressiveImageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastLengthRef = useRef(0);
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Paint new scanlines incrementally
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const newLines = scanlines.slice(lastLengthRef.current);
    if (newLines.length === 0) return;

    // Resize canvas if needed
    if (canvas.width !== imageWidth || canvas.height !== scanlines.length) {
      canvas.width = imageWidth;
      canvas.height = Math.max(scanlines.length, 1);
    }

    newLines.forEach((line, i) => {
      const y = lastLengthRef.current + i;
      const imageData = ctx.createImageData(imageWidth, 1);
      imageData.data.set(line.subarray(0, imageWidth * 4));
      ctx.putImageData(imageData, 0, y);
    });

    lastLengthRef.current = scanlines.length;
  }, [scanlines, imageWidth]);

  // Reset when image changes (new pass, new file)
  useEffect(() => {
    if (scanlines.length === 0) {
      lastLengthRef.current = 0;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.width = imageWidth;
      canvas.height = 1;
    }
  }, [scanlines.length, imageWidth]);

  const save = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || scanlines.length === 0) return;
    const link = document.createElement("a");
    link.download = `${label ?? "image"}-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, [scanlines.length, label]);

  const isEmpty = scanlines.length === 0;
  const progress = isEmpty ? 0 : Math.min(100, Math.round((scanlines.length / Math.max(scanlines.length, 1)) * 100));

  return (
    <div className="progressive-image" ref={containerRef} style={style}>
      {/* Controls */}
      <div className="progressive-image__toolbar">
        {label && <span className="progressive-image__label">{label}</span>}
        {badge && <span className="progressive-image__badge">{badge}</span>}
        <div className="progressive-image__toolbar-right">
          <span className="progressive-image__scanline-count">
            {isEmpty ? "Waiting…" : `${scanlines.length} lines`}
          </span>
          <button
            className="progressive-image__zoom"
            onClick={() => setZoom((z) => z >= 2 ? 0.5 : z + 0.5)}
            title="Cycle zoom"
          >
            {zoom}×
          </button>
          <button
            className="progressive-image__save"
            onClick={save}
            disabled={isEmpty}
            title="Save PNG"
          >
            ⬇ Save
          </button>
        </div>
      </div>

      {/* Canvas area */}
      <div className="progressive-image__canvas-wrap">
        {isEmpty && (
          <div className="progressive-image__empty">
            <span className="progressive-image__empty-icon">🛰️</span>
            <span className="progressive-image__empty-label">Awaiting satellite pass…</span>
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="progressive-image__canvas"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: "top left",
            display: isEmpty ? "none" : "block",
          }}
        />
        {scanlineMotif && !isEmpty && (
          <div className="progressive-image__scanline-motif" aria-hidden />
        )}
      </div>

      {/* Progress bar — grows as lines arrive */}
      {!isEmpty && (
        <div className="progressive-image__progress-bar">
          <div
            className="progressive-image__progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
