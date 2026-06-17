import { useState, useCallback, useRef, type ChangeEvent } from "react";
import { AppScreen } from "../../components/kit/AppScreen";
import { Icon } from "../../components/kit/Icon";
import "./Notepad.css";

const LS_KEY = "mayhem_notepad";

function loadText(): string { return localStorage.getItem(LS_KEY) ?? ""; }

export function NotepadApp() {
  const [text, setText]     = useState(loadText);
  const [saved, setSaved]   = useState(false);
  const textareaRef         = useRef<HTMLTextAreaElement>(null);
  const saveTimer           = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    localStorage.setItem(LS_KEY, val);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaved(true);
    saveTimer.current = setTimeout(() => setSaved(false), 1200);
  }, []);

  const insertAtCursor = (snippet: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? text.length;
    const end   = ta.selectionEnd ?? text.length;
    const before = text.slice(0, start);
    const after  = text.slice(end);
    const sep = before.length > 0 && !before.endsWith("\n") ? "\n" : "";
    const next = `${before}${sep}${snippet}`;
    const newCursor = next.length;
    setText(next + after);
    localStorage.setItem(LS_KEY, next + after);
    setSaved(true);
    setTimeout(() => { ta.focus(); ta.setSelectionRange(newCursor, newCursor); }, 0);
    setTimeout(() => setSaved(false), 1200);
  };

  const insertTimestamp = () => {
    const d = new Date();
    const ts = `[${d.toISOString().replace("T", " ").slice(0, 19)}] `;
    insertAtCursor(ts);
  };

  const insertFreqLine = () => {
    insertAtCursor("[freq: __________ MHz] ");
  };

  const clear = () => {
    if (text.length > 0 && !window.confirm("Clear all notes?")) return;
    setText("");
    localStorage.removeItem(LS_KEY);
  };

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const lineCount = text ? text.split("\n").length : 0;

  const statusText = saved
    ? "Saved"
    : `${wordCount} word${wordCount !== 1 ? "s" : ""} · ${lineCount} line${lineCount !== 1 ? "s" : ""}`;

  return (
    <AppScreen
      appId="notepad"
      title="Notepad"
      subtitle="Field Notes"
      status={saved ? "live" : "idle"}
      statusText={statusText}
      actions={
        <div className="npad-actions">
          <button className="npad-action-btn" onClick={insertTimestamp} title="Insert current time"><Icon name="timer" size={14} /> Timestamp</button>
          <button className="npad-action-btn" onClick={insertFreqLine} title="Insert frequency line"><Icon name="radio" size={14} /> Freq</button>
          <button className="npad-action-btn npad-action-btn--clear" onClick={clear} title="Clear all"><Icon name="close" size={14} /> Clear</button>
        </div>
      }
    >
      <div className="npad-paper">
        <textarea
          ref={textareaRef}
          className="npad-textarea"
          value={text}
          onChange={handleChange}
          placeholder="Notes, frequencies, observations…"
          spellCheck
          autoFocus
        />
        {saved && <div className="npad-saved-flash"><Icon name="check" size={12} /> saved</div>}
      </div>
    </AppScreen>
  );
}
