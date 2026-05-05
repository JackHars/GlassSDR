import { useEffect, useRef } from "react";
import type { SpectrumFrame } from "../ipc/types/SpectrumFrame";

interface Props {
  width: number;
  height: number;
  /** Latest spectrum frame. The component accumulates rows over time. */
  frame: SpectrumFrame | null;
}

export function Waterfall({ width, height, frame }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastSeq = useRef<number>(-1);

  useEffect(() => {
    if (!frame || !canvasRef.current) return;
    if (frame.seq === lastSeq.current) return;
    lastSeq.current = frame.seq;

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    // Scroll up by 1 row
    const img = ctx.getImageData(0, 1, width, height - 1);
    ctx.putImageData(img, 0, 0);

    // Draw new bottom row
    const row = ctx.createImageData(width, 1);
    const bins = frame.bins;
    for (let x = 0; x < width; x++) {
      // map x → bin index via nearest-neighbor scaling
      const i = Math.floor((x * bins.length) / width);
      const v = bins[i];
      const [r, g, b] = colormap(v);
      const idx = x * 4;
      row.data[idx] = r;
      row.data[idx + 1] = g;
      row.data[idx + 2] = b;
      row.data[idx + 3] = 255;
    }
    ctx.putImageData(row, 0, height - 1);
  }, [frame, width, height]);

  return <canvas ref={canvasRef} width={width} height={height} style={{ background: "#000" }} />;
}

/** Simple viridis-like colormap: 0..255 → RGB. */
function colormap(v: number): [number, number, number] {
  const t = v / 255;
  const r = Math.floor(255 * Math.max(0, Math.min(1, 1.5 * t - 0.3)));
  const g = Math.floor(255 * Math.max(0, Math.min(1, 1.2 * t)));
  const b = Math.floor(255 * Math.max(0, Math.min(1, 1 - 1.2 * t + 0.3)));
  return [r, g, b];
}
