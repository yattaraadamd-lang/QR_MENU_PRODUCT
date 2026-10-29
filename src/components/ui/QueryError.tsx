/**
 * Liste sorgusu hatası (useApiQuery). role="alert" ile belirdiği an duyurulur; polling
 * sürdüğü için bağlantı dönünce kendiliğinden kalkar, "Tekrar dene" beklemeden yeniler.
 */
export default function QueryError({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        padding: "10px 14px", marginBottom: 12, borderRadius: 12,
        background: "rgba(217,45,32,0.10)", border: "1px solid rgba(217,45,32,0.35)",
      }}
    >
      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--danger-text)", lineHeight: 1.5 }}>⚠️ {message}</p>
      <button type="button" className="btn btn-ghost btn-sm" onClick={onRetry}>
        Tekrar dene
      </button>
    </div>
  );
}
