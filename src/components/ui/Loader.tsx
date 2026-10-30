import React from "react";

interface LoaderProps {
  label?: string;
  emoji?: string;
  fullScreen?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

// Dönen çift halka + zıplayan noktalı etiket. Saf CSS, sunucu bileşenlerinde de çalışır.
export default function Loader({ label = "Yükleniyor", emoji, fullScreen = false, className = "", style }: LoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`loader ${fullScreen ? "min-h-viewport" : ""} ${className}`.replace(/\s+/g, " ").trim()}
      style={style}
    >
      <div className="loader-ring">{emoji && <span className="loader-emoji">{emoji}</span>}</div>
      <span className="loader-label">
        {label}
        <span className="loader-dots" aria-hidden>
          <span>.</span>
          <span>.</span>
          <span>.</span>
        </span>
      </span>
    </div>
  );
}
