import { ReactNode } from "react";
import "./GlassPanel.css";

type PanelSize = "sm" | "md" | "lg" | "fill";
type PanelPad = "none" | "sm" | "md" | "lg";

interface GlassPanelProps {
  title?: string;
  titleRight?: ReactNode;
  size?: PanelSize;
  pad?: PanelPad;
  accent?: boolean;
  className?: string;
  children?: ReactNode;
  style?: React.CSSProperties;
}

/** Translucent glass container — the primary surface primitive for kit components. */
export function GlassPanel({
  title,
  titleRight,
  size = "md",
  pad = "md",
  accent = false,
  className = "",
  children,
  style,
}: GlassPanelProps) {
  return (
    <div
      className={`glass-panel-kit glass-panel-kit--${size} glass-panel-kit--pad-${pad}${accent ? " glass-panel-kit--accent" : ""}${className ? ` ${className}` : ""}`}
      style={style}
    >
      {(title || titleRight) && (
        <div className="glass-panel-kit__header">
          {title && <span className="glass-panel-kit__title">{title}</span>}
          {titleRight && <div className="glass-panel-kit__title-right">{titleRight}</div>}
        </div>
      )}
      <div className="glass-panel-kit__body">{children}</div>
    </div>
  );
}

interface GlassCardProps {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  accent?: boolean;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
  children?: ReactNode;
}

/** Compact glass card — for entity tiles, detail cards, stat groups. */
export function GlassCard({
  title,
  subtitle,
  actions,
  accent = false,
  selected = false,
  onClick,
  className = "",
  children,
}: GlassCardProps) {
  return (
    <div
      className={`glass-card${accent ? " glass-card--accent" : ""}${selected ? " glass-card--selected" : ""}${onClick ? " glass-card--clickable" : ""}${className ? ` ${className}` : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
    >
      {(title || subtitle || actions) && (
        <div className="glass-card__header">
          <div className="glass-card__header-text">
            {title && <span className="glass-card__title">{title}</span>}
            {subtitle && <span className="glass-card__subtitle">{subtitle}</span>}
          </div>
          {actions && <div className="glass-card__actions">{actions}</div>}
        </div>
      )}
      {children && <div className="glass-card__body">{children}</div>}
    </div>
  );
}
