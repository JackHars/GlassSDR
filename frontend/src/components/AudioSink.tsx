import { useEffect, useRef, useState } from "react";
import type { AudioFrame } from "../ipc/types/AudioFrame";

interface Props {
  /** Latest audio frame to enqueue. */
  frame: AudioFrame | null;
}

export function AudioSink({ frame }: Props) {
  const ctxRef = useRef<AudioContext | null>(null);
  const nodeRef = useRef<AudioWorkletNode | null>(null);
  const [armed, setArmed] = useState(false);

  const arm = async () => {
    const ctx = new AudioContext({ sampleRate: 48000 });
    await ctx.audioWorklet.addModule("/audio-worklet-processor.js");
    const node = new AudioWorkletNode(ctx, "ring-buffer");
    node.connect(ctx.destination);
    ctxRef.current = ctx;
    nodeRef.current = node;
    setArmed(true);
  };

  useEffect(() => {
    if (!frame || !nodeRef.current) return;
    // Convert int16 → Float32 in [-1, 1]
    const f32 = new Float32Array(frame.samples.length);
    for (let i = 0; i < frame.samples.length; i++) {
      f32[i] = frame.samples[i] / 32768;
    }
    nodeRef.current.port.postMessage(f32);
  }, [frame]);

  return (
    <div style={{ padding: 8 }}>
      {armed ? (
        <span style={{ color: "#0f0" }}>Audio: armed</span>
      ) : (
        <button onClick={arm}>Enable audio</button>
      )}
    </div>
  );
}
