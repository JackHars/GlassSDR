import { useRef, useEffect, useCallback } from "react";
import "./Timeline.css";

export interface TimelineSegment {
  startMs: number;
  endMs: number;
  label?: string;
  color?: string;
  /** 0-1 intensity — drives opacity of the segment */
  intensity?: number;
}

interface TimelineProps {
  segments: TimelineSegment[];
  /** Total window duration in ms */
  windowMs?: number;
  /** Current playhead position in ms (optional) */
  playheadMs?: number;
  label?: string;
  height?: number;
  className?: string;
}

/** Horizontal time axis for scanners, hoppers, playlists, OOK pulse trains. */
export function Timeline({
  segments,
  windowMs = 10000,
  playheadMs,
  label,
  height = 48,
  className = "",
}: TimelineProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    // Background
    ctx.clearRect(0, 0, w, h);

    // Time grid — 10 ticks
    const ticks = 10;
    ctx.strokeStyle = "rgba(0,0,0,0.06)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= ticks; i++) {
      const x = (i / ticks) * w;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    // Segments
    const now = Date.now();
    const windowStart = now - windowMs;

    segments.forEach((seg) => {
      const x1 = Math.max(0, ((seg.startMs - windowStart) / windowMs) * w);
      const x2 = Math.min(w, ((seg.endMs - windowStart) / windowMs) * w);
      if (x2 <= x1) return;

      const alpha = seg.intensity ?? 0.75;
      ctx.fillStyle = seg.color ?? "var(--accent)";
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.roundRect(x1, h * 0.2, Math.max(2, x2 - x1), h * 0.6, 3);
      ctx.fill();
      ctx.globalAlpha = 1;

      if (seg.label && x2 - x1 > 30) {
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.font = `500 10px var(--font-sans, sans-serif)`;
        ctx.textBaseline = "middle";
        ctx.fillText(seg.label, x1 + 4, h * 0.5);
      }
    });

    // Playhead
    if (playheadMs !== undefined) {
      const px = ((playheadMs - windowStart) / windowMs) * w;
      if (px >= 0 && px <= w) {
        ctx.strokeStyle = "var(--danger)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(px, 0);
        ctx.lineTo(px, h);
        ctx.stroke();
      }
    }
  }, [segments, windowMs, playheadMs]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const obs = new ResizeObserver(draw);
    if (canvasRef.current) obs.observe(canvasRef.current);
    return () => obs.disconnect();
  }, [draw]);

  return (
    <div className={`timeline${className ? ` ${className}` : ""}`} style={{ height }}>
      {label && <span className="timeline__label">{label}</span>}
      <canvas ref={canvasRef} className="timeline__canvas" />
    </div>
  );
}
