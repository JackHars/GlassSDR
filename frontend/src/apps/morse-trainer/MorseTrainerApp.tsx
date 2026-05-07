import { useState, useRef, useCallback } from "react";
import { AppShell, ControlField, ControlRow } from "../../components/AppShell";

const MORSE: Record<string, string> = {
  A:".-",B:"-...",C:"-.-.",D:"-..",E:".",F:"..-.",G:"--.",H:"....",I:"..",J:".---",
  K:"-.-",L:".-..",M:"--",N:"-.",O:"---",P:".--.",Q:"--.-",R:".-.",S:"...",T:"-",
  U:"..-",V:"...-",W:".--",X:"-..-",Y:"-.--",Z:"--.."
};
const LETTERS = Object.keys(MORSE);

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
    setScore((s) => correct ? { ...s, right: s.right + 1 } : { ...s, wrong: s.wrong + 1 });
  }, [letter, answer]);

  return (
    <AppShell
      title="Morse Trainer"
      status={<span style={{ fontFamily: "var(--font-mono)" }}>✓ {score.right} · ✗ {score.wrong}</span>}
      controls={
        <ControlRow
          actions={
            <>
              <button className="glass-btn primary" onClick={nextLetter}>New Letter</button>
              <button className="glass-btn" onClick={play} disabled={!letter}>Play</button>
            </>
          }
        >
          <ControlField label={`Speed ${wpm} WPM`} size="md">
            <input type="range" min={5} max={40} value={wpm} onChange={(e) => setWpm(+e.target.value)} />
          </ControlField>
          <ControlField label={`Pitch ${pitch} Hz`} size="md">
            <input type="range" min={300} max={1200} step={50} value={pitch} onChange={(e) => setPitch(+e.target.value)} />
          </ControlField>
        </ControlRow>
      }
    >
      <div className="app-shell__grow" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, minHeight: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 650, textTransform: "uppercase", letterSpacing: 0.6, color: "var(--text-secondary)" }}>
          Listen and identify the letter
        </div>
        <div style={{
          fontFamily: "var(--font-mono)",
          fontSize: 60,
          color: letter ? "var(--accent)" : "var(--text-tertiary)",
          background: "rgba(255,255,255,0.55)",
          border: "1px solid rgba(255,255,255,0.7)",
          padding: "16px 32px",
          borderRadius: 16,
          backdropFilter: "blur(16px)",
          minWidth: 200,
          textAlign: "center",
        }}>
          {letter ? MORSE[letter] : "—"}
        </div>
        {letter && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && check()}
              placeholder="Type the letter…"
              autoFocus
              style={{ fontSize: 18, width: 200, textAlign: "center" }}
            />
            <button className="glass-btn" onClick={check}>Check</button>
          </div>
        )}
        {feedback && (
          <div style={{
            color: feedback.startsWith("C") ? "#34C759" : "#FF3B30",
            fontWeight: 700,
            fontSize: 16,
          }}>
            {feedback}
          </div>
        )}
      </div>
    </AppShell>
  );
}
