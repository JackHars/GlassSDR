import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

interface SpectrumFrame { seq: number; data: number[] }
interface AudioFrame { seq: number; samples: number[] }

export default function App() {
  const [specStats, setSpecStats] = useState({ count: 0, gaps: 0, lastSeq: -1 });
  const [audioStats, setAudioStats] = useState({ count: 0, gaps: 0, lastSeq: -1 });

  useEffect(() => {
    const u1 = listen<SpectrumFrame>("spectrum", (e) => {
      setSpecStats((s) => {
        const expected = s.lastSeq + 1;
        const gap = e.payload.seq !== expected && s.lastSeq !== -1 ? 1 : 0;
        return { count: s.count + 1, gaps: s.gaps + gap, lastSeq: e.payload.seq };
      });
    });
    const u2 = listen<AudioFrame>("audio", (e) => {
      setAudioStats((s) => {
        const expected = s.lastSeq + 1;
        const gap = e.payload.seq !== expected && s.lastSeq !== -1 ? 1 : 0;
        return { count: s.count + 1, gaps: s.gaps + gap, lastSeq: e.payload.seq };
      });
    });
    invoke("start_stream");
    return () => {
      u1.then((f) => f());
      u2.then((f) => f());
    };
  }, []);

  return (
    <div style={{ fontFamily: "monospace", padding: 20 }}>
      <div>spectrum: {specStats.count} received, {specStats.gaps} gaps</div>
      <div>audio: {audioStats.count} received, {audioStats.gaps} gaps</div>
    </div>
  );
}
