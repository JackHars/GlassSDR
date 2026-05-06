import { useEffect, useRef } from "react";

const MAP = [
  "##########",
  "#........#",
  "#.##.##..#",
  "#........#",
  "#...#....#",
  "#...#....#",
  "#........#",
  "##########",
];
const W = 320, H = 200, FOV = Math.PI / 3, RAYS = W;

function isWall(x: number, y: number) {
  const mx = Math.floor(x), my = Math.floor(y);
  if (my < 0 || my >= MAP.length || mx < 0 || mx >= MAP[0].length) return true;
  return MAP[my][mx] === "#";
}

export function DoomApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pos = useRef({ x: 1.5, y: 1.5, angle: 0 });
  const keys = useRef<Record<string, boolean>>({});

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => { keys.current[e.key] = true; };
    const onUp = (e: KeyboardEvent) => { delete keys.current[e.key]; };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);

    let rafId: number;
    const render = () => {
      const p = pos.current;
      const k = keys.current;
      const spd = 0.04, rot = 0.03;
      if (k["ArrowLeft"]) p.angle -= rot;
      if (k["ArrowRight"]) p.angle += rot;
      if (k["w"] || k["ArrowUp"]) { const nx = p.x + Math.cos(p.angle)*spd, ny = p.y + Math.sin(p.angle)*spd; if (!isWall(nx,p.y)) p.x=nx; if (!isWall(p.x,ny)) p.y=ny; }
      if (k["s"] || k["ArrowDown"]) { const nx = p.x - Math.cos(p.angle)*spd, ny = p.y - Math.sin(p.angle)*spd; if (!isWall(nx,p.y)) p.x=nx; if (!isWall(p.x,ny)) p.y=ny; }

      const cv = canvasRef.current; if (!cv) return;
      const ctx = cv.getContext("2d")!;
      ctx.fillStyle = "#111"; ctx.fillRect(0,0,W,H);
      ctx.fillStyle = "#334"; ctx.fillRect(0,H/2,W,H/2);

      for (let col = 0; col < RAYS; col++) {
        const rayAngle = p.angle - FOV/2 + (col/RAYS)*FOV;
        const dx = Math.cos(rayAngle), dy = Math.sin(rayAngle);
        let dist = 0;
        while (dist < 16) {
          dist += 0.02;
          if (isWall(p.x + dx*dist, p.y + dy*dist)) break;
        }
        const corrected = dist * Math.cos(rayAngle - p.angle);
        const wallH = Math.min(H, H / corrected);
        const shade = Math.max(0, Math.min(255, 255 - dist * 30));
        ctx.fillStyle = `rgb(${shade},${Math.floor(shade*0.6)},${Math.floor(shade*0.3)})`;
        ctx.fillRect(col, (H - wallH) / 2, 1, wallH);
      }

      // crosshair
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fillRect(W/2-1,H/2-6,2,12); ctx.fillRect(W/2-6,H/2-1,12,2);

      rafId = requestAnimationFrame(render);
    };
    rafId = requestAnimationFrame(render);
    return () => { cancelAnimationFrame(rafId); window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); };
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>Doom-style Raycaster</h2>
      <canvas ref={canvasRef} width={W} height={H} style={{ border: "1px solid #333", display: "block", imageRendering: "pixelated" }} tabIndex={0} />
      <div style={{ marginTop: 8, fontSize: 12, color: "#555" }}>WASD to move · Arrow Left/Right to turn</div>
    </div>
  );
}
