import { ReactNode } from "react";
import "./Composer.css";

type ComposerMode = "text" | "hex" | "image";

interface ComposerField {
  label: string;
  control: ReactNode;
}

interface ComposerProps {
  /** Extra labelled fields above the main input (e.g. address, speed) */
  fields?: ComposerField[];
  /** Main editor mode */
  mode?: ComposerMode;
  /** Mode switcher tabs — omit if the app has only one mode */
  modes?: Array<{ id: ComposerMode; label: string }>;
  onModeChange?: (mode: ComposerMode) => void;
  /** Preview pane content (encoded output, waveform preview, etc.) */
  preview?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/**
 * Message/payload editor for TX apps.
 * Renders optional field rows above the main editor slot, with an
 * encoded-preview panel below. The actual input (textarea, hex grid,
 * image picker) is passed as children.
 */
export function Composer({
  fields,
  mode = "text",
  modes,
  onModeChange,
  preview,
  children,
  className = "",
}: ComposerProps) {
  return (
    <div className={`composer${className ? ` ${className}` : ""}`}>
      {/* Field rows (address, speed, etc.) */}
      {fields && fields.length > 0 && (
        <div className="composer__fields">
          {fields.map((f, i) => (
            <div key={i} className="composer__field">
              <label className="composer__field-label">{f.label}</label>
              <div className="composer__field-control">{f.control}</div>
            </div>
          ))}
        </div>
      )}

      {/* Mode tabs */}
      {modes && modes.length > 1 && (
        <div className="composer__mode-tabs">
          {modes.map((m) => (
            <button
              key={m.id}
              className={`composer__mode-tab${mode === m.id ? " composer__mode-tab--active" : ""}`}
              onClick={() => onModeChange?.(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

      {/* Main editor (textarea / hex grid / image picker via children) */}
      <div className="composer__editor">{children}</div>

      {/* Encoded preview */}
      {preview && (
        <div className="composer__preview">
          <span className="composer__preview-label">Encoded preview</span>
          <div className="composer__preview-content">{preview}</div>
        </div>
      )}
    </div>
  );
}
