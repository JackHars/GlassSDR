import { useState, useCallback, type ChangeEvent } from "react";

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
    <div style={{ padding: 16, display: "flex", flexDirection: "column", height: "calc(100vh - 48px)", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>Notepad</h2>
        <button onClick={insertTimestamp} style={{ background: "#226", color: "#eee", border: "none", borderRadius: 3, padding: "4px 10px", cursor: "pointer", fontSize: 13 }}>Insert timestamp</button>
        <button onClick={clear} style={{ background: "#400", color: "#eee", border: "none", borderRadius: 3, padding: "4px 10px", cursor: "pointer", fontSize: 13 }}>Clear</button>
        {saved && <span style={{ color: "#4c4", fontSize: 12 }}>Auto-saved</span>}
      </div>
      <textarea
        value={text}
        onChange={handleChange}
        style={{
          flex: 1,
          background: "#1a1a1a",
          color: "#ddd",
          border: "1px solid #333",
          borderRadius: 4,
          padding: 10,
          fontFamily: "monospace",
          fontSize: 13,
          resize: "none",
          lineHeight: 1.5,
        }}
        placeholder="Start typing… notes are auto-saved to localStorage."
      />
      <div style={{ marginTop: 6, fontSize: 11, color: "#555", textAlign: "right" }}>
        {text.length} chars · {text.split("\n").length} lines
      </div>
    </div>
  );
}
