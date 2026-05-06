import { useEffect, useRef, useState, useCallback } from "react";

const COLS = 20, ROWS = 20, CELL = 20;
const DIR = { ArrowUp: [0,-1], ArrowDown: [0,1], ArrowLeft: [-1,0], ArrowRight: [1,0],
              w: [0,-1], s: [0,1], a: [-1,0], d: [1,0] } as Record<string, [number,number]>;

function rand() { return [Math.floor(Math.random()*COLS), Math.floor(Math.random()*ROWS)] as [number,number]; }

export function SnakeApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ snake: [[10,10]] as [number,number][], dir: [1,0] as [number,number], food: rand(), alive: true, score: 0 });
  const [score, setScore] = useState(0);
  const [dead, setDead] = useState(false);
  const hiKey = "snake_hi";
  const [hi, setHi] = useState(() => parseInt(localStorage.getItem(hiKey) ?? "0"));

  const draw = useCallback(() => {
    const cv = canvasRef.current; if (!cv) return;
    const ctx = cv.getContext("2d")!;
    ctx.fillStyle = "#111"; ctx.fillRect(0,0,COLS*CELL,ROWS*CELL);
    const { snake, food } = stateRef.current;
    ctx.fillStyle = "#4f4";
    for (const [x,y] of snake) ctx.fillRect(x*CELL+1,y*CELL+1,CELL-2,CELL-2);
    ctx.fillStyle = "#f44";
    ctx.fillRect(food[0]*CELL+2, food[1]*CELL+2, CELL-4, CELL-4);
  }, []);

  const tick = useCallback(() => {
    const s = stateRef.current; if (!s.alive) return;
    const [dx,dy] = s.dir;
    const [hx,hy] = s.snake[0];
    const nx: [number,number] = [(hx+dx+COLS)%COLS, (hy+dy+ROWS)%ROWS];
    if (s.snake.some(([x,y]) => x===nx[0] && y===nx[1])) {
      s.alive = false; setDead(true);
      const newHi = Math.max(hi, s.score);
      localStorage.setItem(hiKey, String(newHi)); setHi(newHi);
      return;
    }
    s.snake.unshift(nx);
    if (nx[0]===s.food[0] && nx[1]===s.food[1]) {
      s.food = rand(); s.score++; setScore(s.score);
    } else { s.snake.pop(); }
    draw();
  }, [draw, hi]);

  useEffect(() => {
    draw();
    const onKey = (e: KeyboardEvent) => {
      const d = DIR[e.key]; if (d) { e.preventDefault(); stateRef.current.dir = d; }
    };
    window.addEventListener("keydown", onKey);
    const id = setInterval(tick, 140);
    return () => { clearInterval(id); window.removeEventListener("keydown", onKey); };
  }, [draw, tick]);

  const restart = () => {
    stateRef.current = { snake: [[10,10]], dir: [1,0], food: rand(), alive: true, score: 0 };
    setScore(0); setDead(false); draw();
  };

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>Snake</h2>
      <div style={{ marginBottom: 8, display: "flex", gap: 24, fontSize: 14, color: "#aaa" }}>
        <span>Score: <b style={{ color: "#eee" }}>{score}</b></span>
        <span>High: <b style={{ color: "#fa0" }}>{hi}</b></span>
        {dead && <button onClick={restart} style={{ padding: "2px 12px", background: "#226", color: "#eee", border: "1px solid #44a", borderRadius: 3, cursor: "pointer" }}>Restart</button>}
      </div>
      {dead && <div style={{ marginBottom: 8, color: "#f44", fontWeight: "bold" }}>Game Over!</div>}
      <canvas ref={canvasRef} width={COLS*CELL} height={ROWS*CELL} style={{ border: "1px solid #333", display: "block" }} tabIndex={0} />
      <div style={{ marginTop: 8, fontSize: 12, color: "#555" }}>Arrow keys or WASD to move</div>
    </div>
  );
}
