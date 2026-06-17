import { useEffect, useRef, useState } from "react";
import type { AudioFrame } from "../ipc/types/AudioFrame";
import { Icon } from "./kit/Icon";

interface Props {
  frame: AudioFrame | null;
}

// Module-level singletons — one AudioContext for the whole app, shared
// across mounts/unmounts. Tauri/Chromium webviews keep an AudioContext
// suspended until a real user gesture, so we install a document-wide
// pointer listener that resumes it the first time the user clicks
// anywhere on the page.
let sharedCtx: AudioContext | null = null;
let sharedNode: AudioWorkletNode | null = null;
let initPromise: Promise<void> | null = null;

async function ensureAudio(): Promise<{ ctx: AudioContext; node: AudioWorkletNode } | null> {
  if (sharedCtx && sharedNode) return { ctx: sharedCtx, node: sharedNode };
  if (initPromise) {
    await initPromise;
    return sharedCtx && sharedNode ? { ctx: sharedCtx, node: sharedNode } : null;
  }
  initPromise = (async () => {
    const ctx = new AudioContext({ sampleRate: 48000 });
    await ctx.audioWorklet.addModule("/audio-worklet-processor.js");
    const node = new AudioWorkletNode(ctx, "ring-buffer");
    node.connect(ctx.destination);
    sharedCtx = ctx;
    sharedNode = node;

    const tryResume = () => { ctx.resume().catch(() => {}); };
    document.addEventListener("pointerdown", tryResume);
    document.addEventListener("keydown", tryResume);
    document.addEventListener("click", tryResume);
    tryResume();
  })();
  await initPromise;
  return sharedCtx && sharedNode ? { ctx: sharedCtx, node: sharedNode } : null;
}

/** Synchronously resume the shared audio context. Call from user-gesture
 *  handlers (e.g. Start button) to guarantee resume happens within the
 *  gesture's event-loop tick. Lazily initializes if needed. */
export function resumeAudio(): void {
  if (sharedCtx) {
    sharedCtx.resume().catch(() => {});
    return;
  }
  // Kick off init; the listener installed inside will pick up future gestures.
  ensureAudio().then(() => {
    sharedCtx?.resume().catch(() => {});
  });
}

/** Play a 440 Hz test tone for ~400 ms — confirms audio path is alive. */
export function playTestTone(): void {
  ensureAudio().then((res) => {
    if (!res) return;
    const { ctx } = res;
    ctx.resume().catch(() => {});
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 440;
    gain.gain.setValueAtTime(0.0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    gain.gain.linearRampToValueAtTime(0.0, ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  });
}

export function AudioSink({ frame }: Props) {
  const [state, setState] = useState<AudioContextState | "uninitialized">("uninitialized");
  const [level, setLevel] = useState(0);
  const ctxRef = useRef<AudioContext | null>(null);
  const nodeRef = useRef<AudioWorkletNode | null>(null);

  useEffect(() => {
    let cancelled = false;
    ensureAudio().then((res) => {
      if (cancelled || !res) return;
      ctxRef.current = res.ctx;
      nodeRef.current = res.node;
      setState(res.ctx.state);
      const onChange = () => setState(res.ctx.state);
      res.ctx.addEventListener("statechange", onChange);
      // We don't remove the listener on unmount because the ctx is shared.
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!frame || !nodeRef.current || !ctxRef.current) return;
    if (ctxRef.current.state === "suspended") {
      ctxRef.current.resume().catch(() => {});
    }
    const samples = frame.samples;
    const f32 = new Float32Array(samples.length);
    let peak = 0;
    for (let i = 0; i < samples.length; i++) {
      const v = samples[i] / 32768;
      f32[i] = v;
      const abs = Math.abs(v);
      if (abs > peak) peak = abs;
    }
    nodeRef.current.port.postMessage(f32);
    setLevel((prev) => Math.max(peak, prev * 0.85));
  }, [frame]);

  const enable = async () => {
    if (!ctxRef.current) return;
    try { await ctxRef.current.resume(); }
    catch (e) { console.warn("AudioSink: resume failed", e); }
  };

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
      background: "rgba(255,255,255,0.45)", borderRadius: 10,
      border: "1px solid rgba(255,255,255,0.6)", fontFamily: "var(--font-mono)", fontSize: 12,
    }}>
      <span style={{ display: "inline-flex", fontSize: 16, color: state === "running" ? "var(--success)" : "var(--text-tertiary)" }}>
        <Icon name={state === "running" ? "volumeUp" : "volumeMute"} size={18} />
      </span>
      <span style={{ color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.4 }}>
        Audio
      </span>
      {state === "running" ? (
        <div style={{ flex: 1, height: 8, borderRadius: 4, background: "rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <div style={{
            width: `${Math.min(100, level * 100)}%`,
            height: "100%",
            background: level > 0.7 ? "#FF3B30" : level > 0.3 ? "#34C759" : "#0066DD",
            transition: "width 80ms linear",
          }} />
        </div>
      ) : (
        <>
          <span style={{ color: "var(--text-tertiary)", flex: 1 }}>
            {state === "suspended" ? "Suspended — click anywhere to start" : state === "uninitialized" ? "Initializing…" : state}
          </span>
          {state === "suspended" && (
            <button className="glass-btn" onClick={enable} style={{ padding: "4px 10px" }}>
              Enable Audio
            </button>
          )}
        </>
      )}
      <button className="glass-btn" onClick={playTestTone} style={{ padding: "4px 10px" }} title="Beep — verifies the audio output path is working">
        Test Tone
      </button>
    </div>
  );
}
