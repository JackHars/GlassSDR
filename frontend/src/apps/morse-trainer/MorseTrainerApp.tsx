import { useState, useRef, useCallback } from "react";

const MORSE: Record<string, string> = {
  A:".-",B:"-...",C:"-.-.",D:"-..",E:".",F:"..-.",G:"--.",H:"....",I:"..",J:".---",
  K:"-.-",L:".-..",M:"--",N:"-.",O:"---",P:".--.",Q:"--.-",R:".-.",S:"...",T:"-",
  U:"..-",V:"...-",W:".--",X:"-..-",Y:"-.--",Z:"--.."
};
const LETTERS = Object.keys(MORSE);
const DIT = 60; // ms at 20 WPM

async function playMorse(code: string, wpm: number, pitchHz: number, ctx: AudioContext) {
  const dit = Math.round(1200 / wpm);
  for (const sym of code) {
    const dur = sym === "." ? dit : dit * 3;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = pitchHz;
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); gain.gain.setValueAtTime(0.3, ctx.currentTime);
    await new Promise<void>(r => setTimeout(r, dur));
    gain.gain.setValueAtTime(0, ctx.currentTime);
    osc.stop();
    await new Promise<void>(r => setTimeout(r, dit));
  }
  void DIT; // suppress unused warning
}

export function MorseTrainerApp() {
  const [wpm, setWpm] = useState(20);
  const [pitch, setPitch] = useState(600);
  const [letter, setLetter] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [score, setScore] = useState({ right: 0, wrong: 0 });
  const [feedback, setFeedback] = useState<string | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const playing = useRef(false);

  const nextLetter = useCallback(() => {
    setLetter(LETTERS[Math.floor(Math.random() * LETTERS.length)]);
    setAnswer(""); setFeedback(null);
  }, []);

  const play = useCallback(async () => {
    if (!letter || playing.current) return;
    if (!audioCtx.current) audioCtx.current = new AudioContext();
    playing.current = true;
    await playMorse(MORSE[letter], wpm, pitch, audioCtx.current);
    playing.current = false;
  }, [letter, wpm, pitch]);

  const check = useCallback(() => {
    if (!letter) return;
    const correct = answer.trim().toUpperCase() === letter;
    setFeedback(correct ? "Correct!" : `Wrong — it was ${letter}`);
    setScore(s => correct ? { ...s, right: s.right+1 } : { ...s, wrong: s.wrong+1 });
  }, [letter, answer]);

  return (
    <div style={{ padding: 16, maxWidth: 500 }}>
      <h2 style={{ marginTop: 0 }}>Morse Trainer</h2>
      <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <label style={{ color: "#aaa", fontSize: 13 }}>WPM <input type="number" value={wpm} min={5} max={40} onChange={e=>setWpm(+e.target.value)} style={{ width: 60, background: "#222", color: "#eee", border: "1px solid #444", borderRadius: 3, padding: "2px 6px" }} /></label>
        <label style={{ color: "#aaa", fontSize: 13 }}>Pitch Hz <input type="number" value={pitch} min={300} max={1200} step={50} onChange={e=>setPitch(+e.target.value)} style={{ width: 70, background: "#222", color: "#eee", border: "1px solid #444", borderRadius: 3, padding: "2px 6px" }} /></label>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={nextLetter} style={{ padding: "6px 14px", background: "#226", color: "#eee", border: "1px solid #44a", borderRadius: 3, cursor: "pointer" }}>New Letter</button>
        <button onClick={play} disabled={!letter} style={{ padding: "6px 14px", background: "#262", color: "#eee", border: "1px solid #4a4", borderRadius: 3, cursor: "pointer" }}>Play</button>
      </div>
      {letter && <>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input value={answer} onChange={e=>setAnswer(e.target.value)} onKeyDown={e=>e.key==="Enter"&&check()} placeholder="Type the letter…" style={{ flex: 1, background: "#222", color: "#eee", border: "1px solid #444", borderRadius: 3, padding: "6px 10px", fontSize: 16 }} autoFocus />
          <button onClick={check} style={{ padding: "6px 14px", background: "#444", color: "#eee", border: "none", borderRadius: 3, cursor: "pointer" }}>Check</button>
        </div>
      </>}
      {feedback && <div style={{ marginBottom: 8, color: feedback.startsWith("C") ? "#4f4" : "#f64", fontWeight: "bold" }}>{feedback}</div>}
      <div style={{ color: "#888", fontSize: 13 }}>Correct: {score.right} · Wrong: {score.wrong}</div>
    </div>
  );
}
