import { useEffect, useRef, useState, useCallback } from "react";
import type { SpectrumFrame } from "../ipc/types/SpectrumFrame";
import { Icon } from "./kit/Icon";

interface Props {
  width?: number;
  height?: number | "fill";
  frame: SpectrumFrame | null;
  centerHz?: number;
  spanHz?: number;
  onTune?: (freqHz: number) => void;
  filterBw?: number;
  onFilterBwChange?: (bwHz: number) => void;
  freqStep?: number;
}

type DragMode = "tune" | "edge-left" | "edge-right" | null;

export function Waterfall({
  width: propWidth,
  height: propHeight = 350,
  frame,
  centerHz = 0,
  spanHz = 2_400_000,
  onTune,
  filterBw = 12_500,
  onFilterBwChange,
  freqStep = 12_500,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastSeq = useRef<number>(-1);
  const [autoWidth, setAutoWidth] = useState(propWidth ?? 1024);
  const [autoHeight, setAutoHeight] = useState<number>(typeof propHeight === "number" ? propHeight : 400);
  const width = propWidth ?? autoWidth;
  const height = typeof propHeight === "number" ? propHeight : autoHeight;
  const fillMode = propHeight === "fill";

  // Auto-size to container width (and height when in fill mode)
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const parent = root.parentElement;
    if (!parent) return;
    const measure = () => {
      if (!propWidth) setAutoWidth(parent.clientWidth);
      if (fillMode) setAutoHeight(Math.max(220, parent.clientHeight));
    };
    measure();
    const obs = new ResizeObserver(measure);
    obs.observe(parent);
    return () => obs.disconnect();
  }, [propWidth, fillMode]);

  // Local visual state — moves immediately, decoupled from actual tuning
  const [visualCenterHz, setVisualCenterHz] = useState(centerHz);
  const [visualBw, setVisualBw] = useState(filterBw);
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const [hoverEdge, setHoverEdge] = useState<DragMode>(null);
  const tuneTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bwTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Visual zoom anchored on the cursor. zoom === 1 means follow centerHz/spanHz
  // directly. zoom > 1 narrows the visible span and uses zoomCenterHz as the
  // anchor point.
  const [zoom, setZoom] = useState(1);
  const [zoomCenterHz, setZoomCenterHz] = useState(centerHz);
  const effectiveCenter = zoom > 1 ? zoomCenterHz : centerHz;
  const effectiveSpan = spanHz / zoom;

  // Re-center the zoomed view when the radio retunes (centerHz prop changes).
  useEffect(() => {
    setZoomCenterHz(centerHz);
  }, [centerHz]);

  // Sync visual center when the actual center changes (e.g. from controls)
  useEffect(() => {
    if (!dragMode) setVisualCenterHz(centerHz);
  }, [centerHz, dragMode]);

  useEffect(() => {
    if (!dragMode) setVisualBw(filterBw);
  }, [filterBw, dragMode]);

  // Waterfall rendering — bins always cover the full spanHz, but we render only
  // the effective sub-range when zoomed in.
  useEffect(() => {
    if (!frame || !canvasRef.current) return;
    if (frame.seq === lastSeq.current) return;
    lastSeq.current = frame.seq;

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    const img = ctx.getImageData(0, 1, width, height - 1);
    ctx.putImageData(img, 0, 0);

    const row = ctx.createImageData(width, 1);
    const bins = frame.bins;
    const binsStartHz = centerHz - spanHz / 2;
    for (let x = 0; x < width; x++) {
      const pixelHz = effectiveCenter - effectiveSpan / 2 + (x / width) * effectiveSpan;
      const binFloat = ((pixelHz - binsStartHz) / spanHz) * bins.length;
      const i = Math.floor(binFloat);
      const v = i >= 0 && i < bins.length ? bins[i] : 0;
      const [r, g, b] = colormap(v);
      const idx = x * 4;
      row.data[idx] = r;
      row.data[idx + 1] = g;
      row.data[idx + 2] = b;
      row.data[idx + 3] = 255;
    }
    ctx.putImageData(row, 0, height - 1);
  }, [frame, width, height, centerHz, spanHz, effectiveCenter, effectiveSpan]);

  const pxToHz = useCallback(
    (px: number) => effectiveCenter - effectiveSpan / 2 + (px / width) * effectiveSpan,
    [effectiveCenter, effectiveSpan, width]
  );

  const hzToPx = useCallback(
    (hz: number) => ((hz - (effectiveCenter - effectiveSpan / 2)) / effectiveSpan) * width,
    [effectiveCenter, effectiveSpan, width]
  );

  // Latest in-flight values so we can flush on mouse-up without waiting for the
  // 300ms debounce. Without this, releasing mid-drag would snap the visual back
  // to the stale prop before the timer pushed the new value upstream.
  const pendingTune = useRef<number | null>(null);
  const pendingBw = useRef<number | null>(null);

  // Debounced tune — visual moves instantly, actual retune after 300ms idle
  const debouncedTune = useCallback(
    (hz: number) => {
      setVisualCenterHz(hz);
      pendingTune.current = hz;
      if (tuneTimeout.current) clearTimeout(tuneTimeout.current);
      tuneTimeout.current = setTimeout(() => {
        onTune?.(hz);
        pendingTune.current = null;
      }, 300);
    },
    [onTune]
  );

  const debouncedBw = useCallback(
    (bw: number) => {
      setVisualBw(bw);
      pendingBw.current = bw;
      if (bwTimeout.current) clearTimeout(bwTimeout.current);
      bwTimeout.current = setTimeout(() => {
        onFilterBwChange?.(bw);
        pendingBw.current = null;
      }, 300);
    },
    [onFilterBwChange]
  );

  const edgeThreshold = 10;
  const filterLeftPx = hzToPx(visualCenterHz - visualBw / 2);
  const filterRightPx = hzToPx(visualCenterHz + visualBw / 2);
  const vCenterPx = hzToPx(visualCenterHz);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;

      if (dragMode === "tune") {
        debouncedTune(pxToHz(x));
        return;
      }
      if (dragMode === "edge-left" || dragMode === "edge-right") {
        const freq = pxToHz(x);
        const offset = Math.abs(freq - visualCenterHz);
        debouncedBw(Math.max(2000, offset * 2));
        return;
      }

      // Hover detection
      if (Math.abs(x - filterLeftPx) < edgeThreshold) {
        setHoverEdge("edge-left");
      } else if (Math.abs(x - filterRightPx) < edgeThreshold) {
        setHoverEdge("edge-right");
      } else {
        setHoverEdge(null);
      }
    },
    [dragMode, filterLeftPx, filterRightPx, pxToHz, visualCenterHz, debouncedTune, debouncedBw]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;

      if (Math.abs(x - filterLeftPx) < edgeThreshold) {
        setDragMode("edge-left");
        e.preventDefault();
        return;
      }
      if (Math.abs(x - filterRightPx) < edgeThreshold) {
        setDragMode("edge-right");
        e.preventDefault();
        return;
      }

      // Click to tune — move overlay immediately
      setDragMode("tune");
      debouncedTune(pxToHz(x));
      e.preventDefault();
    },
    [filterLeftPx, filterRightPx, pxToHz, debouncedTune]
  );

  const handleMouseUp = useCallback(() => {
    // Flush any pending debounced change so the parent has the latest value
    // before the snap-back effect runs — otherwise visualBw briefly reverts to
    // the stale prop and you see the bandwidth jerk back then forward.
    if (pendingTune.current !== null) {
      if (tuneTimeout.current) clearTimeout(tuneTimeout.current);
      onTune?.(pendingTune.current);
      pendingTune.current = null;
    }
    if (pendingBw.current !== null) {
      if (bwTimeout.current) clearTimeout(bwTimeout.current);
      onFilterBwChange?.(pendingBw.current);
      pendingBw.current = null;
    }
    setDragMode(null);
  }, [onTune, onFilterBwChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        debouncedTune(visualCenterHz - freqStep);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        debouncedTune(visualCenterHz + freqStep);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        debouncedBw(Math.min(visualBw * 1.5, spanHz / 2));
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        debouncedBw(Math.max(visualBw / 1.5, 2000));
      }
    },
    [visualCenterHz, freqStep, visualBw, spanHz, debouncedTune, debouncedBw]
  );

  // Scroll-to-zoom anchored on the tuned frequency (the white center line),
  // not on the cursor. Scroll up = zoom in.
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.2 : 1 / 1.2;
      const newZoom = Math.max(1, Math.min(50, zoom * factor));
      if (newZoom === zoom) return;

      // Clear waterfall history so old rows (which were drawn at a different
      // mapping) don't ghost into the new view.
      const ctx = canvasRef.current?.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, width, height);

      if (newZoom <= 1.001) {
        setZoom(1);
        setZoomCenterHz(centerHz);
      } else {
        setZoom(newZoom);
        setZoomCenterHz(visualCenterHz);
      }
    },
    [zoom, centerHz, visualCenterHz, width, height]
  );

  const cursor = dragMode
    ? dragMode === "tune" ? "grabbing" : "ew-resize"
    : hoverEdge ? "ew-resize" : "crosshair";

  // Animate overlay only when NOT dragging (dragging needs instant response)
  const transition = dragMode ? "none" : "left 120ms ease-out, width 120ms ease-out";

  return (
    <div
      ref={containerRef}
      className={fillMode ? "app-shell__grow" : undefined}
      style={{ position: "relative", width: propWidth ?? "100%", height, cursor, outline: "none", borderRadius: 12, overflow: "hidden", background: "#000" }}
      tabIndex={0}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onKeyDown={handleKeyDown}
      onWheel={handleWheel}
    >
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ background: "#000", display: "block" }}
      />

      {/* Filter region overlay */}
      <div
        className="wf-overlay"
        style={{
          position: "absolute",
          top: 0,
          left: Math.max(0, filterLeftPx),
          width: Math.min(width, filterRightPx) - Math.max(0, filterLeftPx),
          height: "100%",
          background: "rgba(0, 122, 255, 0.12)",
          borderLeft: "2px solid rgba(0, 122, 255, 0.6)",
          borderRight: "2px solid rgba(0, 122, 255, 0.6)",
          pointerEvents: "none",
          boxSizing: "border-box",
          transition,
        }}
      />

      {/* Center tune line */}
      <div
        className="wf-overlay"
        style={{
          position: "absolute",
          top: 0,
          left: vCenterPx - 1,
          width: 2,
          height: "100%",
          background: "rgba(255, 255, 255, 0.8)",
          pointerEvents: "none",
          boxShadow: "0 0 6px rgba(255,255,255,0.4)",
          transition: dragMode ? "none" : "left 120ms ease-out",
        }}
      />

      {/* Draggable edge indicators (glow when hovering) */}
      {(hoverEdge === "edge-left" || dragMode === "edge-left") && (
        <div className="wf-overlay" style={{
          position: "absolute", top: 0, left: filterLeftPx - 4, width: 8, height: "100%",
          background: "rgba(0, 122, 255, 0.25)", pointerEvents: "none",
          borderRadius: 4, transition,
        }} />
      )}
      {(hoverEdge === "edge-right" || dragMode === "edge-right") && (
        <div className="wf-overlay" style={{
          position: "absolute", top: 0, left: filterRightPx - 4, width: 8, height: "100%",
          background: "rgba(0, 122, 255, 0.25)", pointerEvents: "none",
          borderRadius: 4, transition,
        }} />
      )}

      {/* Frequency readout */}
      {visualCenterHz > 0 && (
        <div
          className="wf-overlay"
          style={{
            position: "absolute",
            top: 6,
            left: vCenterPx + 8,
            color: "#fff",
            fontSize: 12,
            fontWeight: 600,
            fontFamily: "var(--font-mono, monospace)",
            textShadow: "0 1px 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.5)",
            pointerEvents: "none",
            whiteSpace: "nowrap",
            transition: dragMode ? "none" : "left 120ms ease-out",
          }}
        >
          {(visualCenterHz / 1e6).toFixed(3)} MHz
        </div>
      )}

      {/* Filter BW readout */}
      <div
        className="wf-overlay"
        style={{
          position: "absolute",
          bottom: 6,
          left: vCenterPx - 30,
          width: 60,
          textAlign: "center",
          color: "rgba(0, 180, 255, 0.95)",
          fontSize: 11,
          fontWeight: 600,
          fontFamily: "var(--font-mono, monospace)",
          textShadow: "0 1px 4px rgba(0,0,0,0.9)",
          pointerEvents: "none",
          transition: dragMode ? "none" : "left 120ms ease-out",
        }}
      >
        {visualBw >= 1000 ? `${(visualBw / 1000).toFixed(1)}k` : `${visualBw}Hz`}
      </div>

      {/* Zoom indicator */}
      {zoom > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            const ctx = canvasRef.current?.getContext("2d");
            if (ctx) ctx.clearRect(0, 0, width, height);
            setZoom(1);
            setZoomCenterHz(centerHz);
          }}
          style={{
            position: "absolute", top: 8, right: 8,
            padding: "4px 10px",
            background: "rgba(0,0,0,0.55)",
            border: "1px solid rgba(255,255,255,0.25)",
            borderRadius: 6,
            color: "#fff",
            fontSize: 11,
            fontFamily: "var(--font-mono, monospace)",
            cursor: "pointer",
          }}
          title="Click to reset zoom"
        >
          {zoom.toFixed(1)}× <Icon name="close" size={11} />
        </button>
      )}

      {/* Frequency scale along bottom edge */}
      <div className="wf-overlay" style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 18,
        display: "flex", justifyContent: "space-between", padding: "0 4px",
        pointerEvents: "none",
      }}>
        {[-0.5, -0.25, 0, 0.25, 0.5].map((frac) => (
          <span key={frac} style={{
            color: "rgba(255,255,255,0.35)", fontSize: 9,
            fontFamily: "var(--font-mono, monospace)",
            textShadow: "0 1px 2px rgba(0,0,0,0.8)",
          }}>
            {((effectiveCenter + frac * effectiveSpan) / 1e6).toFixed(zoom > 4 ? 4 : zoom > 1 ? 3 : 2)}
          </span>
        ))}
      </div>
    </div>
  );
}

/** GNU Radio-style waterfall colormap: dark → blue → cyan → green → yellow → red → white */
function colormap(v: number): [number, number, number] {
  const t = v / 255;
  if (t < 0.15) {
    // black → dark blue
    const s = t / 0.15;
    return [0, 0, Math.floor(80 * s)];
  } else if (t < 0.35) {
    // dark blue → blue → cyan
    const s = (t - 0.15) / 0.2;
    return [0, Math.floor(255 * s), Math.floor(80 + 175 * s)];
  } else if (t < 0.5) {
    // cyan → green
    const s = (t - 0.35) / 0.15;
    return [0, 255, Math.floor(255 * (1 - s))];
  } else if (t < 0.65) {
    // green → yellow
    const s = (t - 0.5) / 0.15;
    return [Math.floor(255 * s), 255, 0];
  } else if (t < 0.85) {
    // yellow → red
    const s = (t - 0.65) / 0.2;
    return [255, Math.floor(255 * (1 - s)), 0];
  } else {
    // red → white
    const s = (t - 0.85) / 0.15;
    return [255, Math.floor(255 * s), Math.floor(255 * s)];
  }
}
