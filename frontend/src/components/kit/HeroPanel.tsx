import { ReactNode } from "react";
import "./HeroPanel.css";

interface HeroPanelProps {
  /** Min height of the hero stage */
  minHeight?: number | string;
  /** Label overlaid top-left */
  label?: string;
  /** Badge overlaid top-right */
  badge?: ReactNode;
  /** Bottom overlay (legend, controls) */
  overlay?: ReactNode;
  fill?: boolean;
  className?: string;
  children?: ReactNode;
  style?: React.CSSProperties;
}

/** Full-bleed glass stage for an app's signature visualization. */
export function HeroPanel({
  minHeight = 280,
  label,
  badge,
  overlay,
  fill = true,
  className = "",
  children,
  style,
}: HeroPanelProps) {
  return (
    <div
      className={`hero-panel${fill ? " hero-panel--fill" : ""}${className ? ` ${className}` : ""}`}
      style={{ minHeight, ...style }}
    >
      {children}
      {label && <span className="hero-panel__label">{label}</span>}
      {badge && <div className="hero-panel__badge">{badge}</div>}
      {overlay && <div className="hero-panel__overlay">{overlay}</div>}
    </div>
  );
}
