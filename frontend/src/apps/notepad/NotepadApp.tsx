import { useState, useCallback, type ChangeEvent } from "react";
import { AppShell, ControlRow } from "../../components/AppShell";

const LS_KEY = "mayhem_notepad";

function loadText(): string {
  return localStorage.getItem(LS_KEY) ?? "";
}

export function NotepadApp() {
  const [text, setText] = useState(loadText);
  const [saved, setSaved] = useState(false);

  const handleChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    localStorage.setItem(LS_KEY, val);
    setSaved(true);
    setTimeout(() => setSaved(false), 800);
  }, []);

  const insertTimestamp = () => {
    const ts = new Date().toISOString();
    setText((prev) => {
      const next = prev + (prev.endsWith("\n") || prev === "" ? "" : "\n") + `[${ts}] `;
      localStorage.setItem(LS_KEY, next);
      return next;
    });
  };

  const clear = () => {
    setText("");
    localStorage.removeItem(LS_KEY);
  };

  return (
    <AppShell
      title="Notepad"
      status={
        <span style={{ color: saved ? "#34C759" : "var(--text-secondary)" }}>
          {saved ? "● Auto-saved" : `${text.length} chars · ${text.split("\n").length} lines`}
        </span>
      }
      controls={
        <ControlRow
          actions={
            <>
              <button className="glass-btn" onClick={insertTimestamp}>Insert timestamp</button>
              <button className="glass-btn" onClick={clear} style={{ background: "rgba(255,59,48,0.12)", color: "#FF3B30", border: "1px solid rgba(255,59,48,0.4)" }}>Clear</button>
            </>
          }
        >
          <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>
            Notes are auto-saved to local storage as you type.
          </span>
        </ControlRow>
      }
    >
      <textarea
        className="app-shell__grow"
        value={text}
        onChange={handleChange}
        placeholder="Start typing — log frequencies, observations, anything you want to keep."
        style={{
          background: "rgba(255,255,255,0.7)",
          color: "var(--text-primary)",
          border: "1px solid rgba(255,255,255,0.7)",
          borderRadius: 12,
          padding: 16,
          fontFamily: "var(--font-mono)",
          fontSize: 14,
          resize: "none",
          lineHeight: 1.5,
          width: "100%",
          minHeight: 200,
        }}
      />
    </AppShell>
  );
}
