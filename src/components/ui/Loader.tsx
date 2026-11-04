interface LoaderProps {
  label?: string;
  fullScreen?: boolean;
  className?: string;
}

const PIXELS = 9;

// 3×3 piksel ızgarası sırayla köze döner (marka motifi) + zıplayan noktalı etiket.
// Saf CSS, sunucu bileşenlerinde de çalışır.
export default function Loader({ label = "Yükleniyor", fullScreen = false, className = "" }: LoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`loader ${fullScreen ? "min-h-viewport" : ""} ${className}`.replace(/\s+/g, " ").trim()}
    >
      <div className="loader-pixels" aria-hidden="true">
        {Array.from({ length: PIXELS }, (_, i) => (
          <span key={i} />
        ))}
      </div>
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
