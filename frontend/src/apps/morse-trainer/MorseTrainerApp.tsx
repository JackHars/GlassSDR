import { useState, useRef, useCallback } from "react";
import { AppScreen } from "../../components/kit/AppScreen";
import { GlassPanel } from "../../components/kit/GlassPanel";
import "./MorseTrainer.css";

const MORSE: Record<string, string> = {
  A:".-", B:"-...", C:"-.-.", D:"-..", E:".", F:"..-.", G:"--.", H:"....",
  I:"..", J:".---", K:"-.-", L:".-..", M:"--", N:"-.", O:"---", P:".--.",
  Q:"--.-", R:".-.", S:"...", T:"-", U:"..-", V:"...-", W:".--", X:"-..-",
  Y:"-.--", Z:"--..",
  "0":"-----","1":".----","2":"..---","3":"...--","4":"....-","5":".....",
  "6":"-....","7":"--...","8":"---..", "9":"----.",
};

// Koch method lesson order (classic)
const KOCH: string[][] = [
  ["K","M"],
  ["K","M","R"],
  ["K","M","R","S"],
  ["K","M","R","S","U"],
  ["K","M","R","S","U","A","P","T"],
  ["K","M","R","S","U","A","P","T","L","O"],
  ["K","M","R","S","U","A","P","T","L","O","W","I"],
  ["K","M","R","S","U","A","P","T","L","O","W","I","N","J","E"],
  ["K","M","R","S","U","A","P","T","L","O","W","I","N","J","E","F","B"],
  ["K","M","R","S","U","A","P","T","L","O","W","I","N","J","E","F","B","C","Q","H","Y","D","V"],
  Object.keys(MORSE).filter((k) => /[A-Z]/.test(k)),
  Object.keys(MORSE),
];

async function playMorse(code: string, wpm: number, pitchHz: number, ctx: AudioContext) {
  const dit = Math.round(1200 / wpm);
  for (const sym of code) {
    const dur = sym === "." ? dit : dit * 3;
    const osc   = ctx.createOscillator();
    const gain  = ctx.createGain();
    osc.frequency.value = pitchHz;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    await new Promise<void>((r) => setTimeout(r, dur));
    gain.gain.setValueAtTime(0, ctx.currentTime);
    osc.stop();
    await new Promise<void>((r) => setTimeout(r, dit));
  }
}

// ── CW Key Paddle SVG ─────────────────────────────────────────────────────────

function CwKeyPaddle({ keying }: { keying: boolean }) {
  return (
    <svg className="mtr-key" viewBox="0 0 140 80" fill="none">
      {/* Base */}
      <rect x="20" y="60" width="100" height="12" rx="4" fill="rgba(180,130,40,0.25)" stroke="rgba(180,130,40,0.5)" strokeWidth="1.5" />
      {/* Post */}
      <rect x="67" y="38" width="6" height="24" rx="2" fill="rgba(180,130,40,0.4)" />
      {/* Lever — rotates slightly when keying */}
      <g transform={keying ? "rotate(-4, 70, 50)" : "rotate(0, 70, 50)"} style={{ transition: "transform 0.06s ease" }}>
        <rect x="20" y="46" width="100" height="8" rx="4" fill="#C09030" stroke="rgba(220,160,50,0.8)" strokeWidth="1" />
        {/* Dit/dah paddles */}
        <rect x="10" y="44" width="12" height="12" rx="3" fill="#D09030" stroke="rgba(220,160,50,0.8)" strokeWidth="1" />
        <rect x="118" y="44" width="12" height="12" rx="3" fill="#D09030" stroke="rgba(220,160,50,0.8)" strokeWidth="1" />
      </g>
      {/* Glow when keying */}
      {keying && (
        <ellipse cx="70" cy="50" rx="50" ry="10" fill="rgba(208,144,48,0.15)" />
      )}
    </svg>
  );
}

// ── Dit/Dah visual display ────────────────────────────────────────────────────

function MorseGlyph({ code, playing }: { code: string; playing: boolean }) {
  return (
    <div className="mtr-glyph" data-playing={playing || undefined}>
      {code.split("").map((sym, i) => (
        <span key={i} className={`mtr-sym mtr-sym--${sym === "." ? "dit" : "dah"}`} />
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function MorseTrainerApp() {
  const [wpm,      setWpm]      = useState(20);
  const [pitch,    setPitch]    = useState(600);
  const [lesson,   setLesson]   = useState(0);
  const [letter,   setLetter]   = useState<string | null>(null);
  const [answer,   setAnswer]   = useState("");
  const [score,    setScore]    = useState({ right: 0, wrong: 0 });
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [playing,  setPlaying]  = useState(false);
  const audioCtx               = useRef<AudioContext | null>(null);
  const playingRef             = useRef(false);

  const pool = KOCH[Math.min(lesson, KOCH.length - 1)];

  const nextLetter = useCallback(() => {
    const l = pool[Math.floor(Math.random() * pool.length)];
    setLetter(l);
    setAnswer("");
    setFeedback(null);
  }, [pool]);

  const playLetter = useCallback(async () => {
    if (!letter || playingRef.current) return;
    if (!audioCtx.current) audioCtx.current = new AudioContext();
    if (audioCtx.current.state === "suspended") await audioCtx.current.resume();
    playingRef.current = true;
    setPlaying(true);
    await playMorse(MORSE[letter] ?? "", wpm, pitch, audioCtx.current);
    setPlaying(false);
    playingRef.current = false;
  }, [letter, wpm, pitch]);

  const check = useCallback(() => {
    if (!letter) return;
    const correct = answer.trim().toUpperCase() === letter;
    setFeedback(correct ? "correct" : "wrong");
    setScore((s) => correct ? { ...s, right: s.right + 1 } : { ...s, wrong: s.wrong + 1 });
  }, [letter, answer]);

  const statusText = `✓ ${score.right}  ✗ ${score.wrong}  ·  Level ${lesson + 1} · ${pool.length} chars`;

  return (
    <AppScreen
      appId="morse_trainer"
      title="Morse Trainer"
      subtitle="CW Practice"
      status="idle"
      statusText={statusText}
      actions={
        <div className="mtr-header-btns">
          <button className="mtr-btn" onClick={nextLetter}>New Letter</button>
          <button className="mtr-btn mtr-btn--play" onClick={playLetter} disabled={!letter || playing}>
            {playing ? "Playing…" : "▶ Play"}
          </button>
        </div>
      }
      controls={
        <div className="mtr-controls">
          <div className="mtr-ctrl-field">
            <label className="mtr-ctrl-label">Speed — {wpm} WPM</label>
            <input
              className="mtr-ctrl-slider"
              type="range"
              min={5}
              max={40}
              value={wpm}
              onChange={(e) => setWpm(+e.target.value)}
            />
          </div>
          <div className="mtr-ctrl-field">
            <label className="mtr-ctrl-label">Pitch — {pitch} Hz</label>
            <input
              className="mtr-ctrl-slider"
              type="range"
              min={300}
              max={1200}
              step={50}
              value={pitch}
              onChange={(e) => setPitch(+e.target.value)}
            />
          </div>
          <div className="mtr-ctrl-field">
            <label className="mtr-ctrl-label">Koch Level</label>
            <input
              className="mtr-ctrl-slider"
              type="range"
              min={0}
              max={KOCH.length - 1}
              value={lesson}
              onChange={(e) => setLesson(+e.target.value)}
            />
          </div>
          <div className="mtr-ctrl-pool">
            {pool.slice(0, 12).join(" ")}
            {pool.length > 12 ? " …" : ""}
          </div>
        </div>
      }
    >
      <div className="mtr-layout">
        {/* Stage — the hero */}
        <GlassPanel title="Practice Stage" pad="lg" style={{ flex: "0 0 auto" }}>
          <div className="mtr-stage">
            {/* CW key paddle */}
            <CwKeyPaddle keying={playing} />

            {/* Morse code display */}
            {letter ? (
              <MorseGlyph code={MORSE[letter] ?? ""} playing={playing} />
            ) : (
              <div className="mtr-start-hint">Press <strong>New Letter</strong> to begin</div>
            )}

            {/* Answer input */}
            {letter && (
              <div className="mtr-answer-row">
                <input
                  className={`mtr-answer-input${
                    feedback === "correct" ? " mtr-answer-input--correct"
                    : feedback === "wrong" ? " mtr-answer-input--wrong"
                    : ""
                  }`}
                  type="text"
                  value={answer}
                  onChange={(e) => { setAnswer(e.target.value.toUpperCase().slice(0, 2)); setFeedback(null); }}
                  onKeyDown={(e) => e.key === "Enter" && check()}
                  placeholder="?"
                  maxLength={2}
                  autoFocus
                />
                <button className="mtr-check-btn" onClick={check} disabled={!answer.trim()}>
                  Check
                </button>
              </div>
            )}

            {/* Feedback */}
            {feedback && letter && (
              <div className={`mtr-feedback mtr-feedback--${feedback}`}>
                {feedback === "correct" ? `✓ Correct — ${letter}` : `✗ Wrong — it was ${letter} (${MORSE[letter]})`}
              </div>
            )}
          </div>
        </GlassPanel>

        {/* Score panel */}
        <GlassPanel title="Session Score">
          <div className="mtr-score">
            <div className="mtr-score-stat">
              <span className="mtr-score-val mtr-score-val--right">{score.right}</span>
              <span className="mtr-score-label">Correct</span>
            </div>
            <div className="mtr-score-divider" />
            <div className="mtr-score-stat">
              <span className="mtr-score-val mtr-score-val--wrong">{score.wrong}</span>
              <span className="mtr-score-label">Wrong</span>
            </div>
            <div className="mtr-score-divider" />
            <div className="mtr-score-stat">
              <span className="mtr-score-val">
                {score.right + score.wrong > 0
                  ? `${Math.round((score.right / (score.right + score.wrong)) * 100)}%`
                  : "—"}
              </span>
              <span className="mtr-score-label">Accuracy</span>
            </div>
          </div>
        </GlassPanel>

        {/* Lesson characters */}
        <GlassPanel title={`Level ${lesson + 1} Characters`}>
          <div className="mtr-chars">
            {pool.map((c) => (
              <div key={c} className={`mtr-char${letter === c ? " mtr-char--active" : ""}`}>
                <span className="mtr-char-letter">{c}</span>
                <span className="mtr-char-code">{MORSE[c]}</span>
              </div>
            ))}
          </div>
        </GlassPanel>
      </div>
    </AppScreen>
  );
}
