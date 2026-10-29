import Loader from "@/components/ui/Loader";

export function MenuLoading() {
  return (
    <div className="customer-theme" style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
      <Loader label="Menü hazırlanıyor" emoji="🍽️" />
    </div>
  );
}

/** Menü alınamadı (geçersiz masa, ağ hatası): sayfanın tek başlığı */
export function MenuAccessError({ message }: { message: string }) {
  return (
    <main id="main-content" className="customer-theme" style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div role="alert" style={{ maxWidth: 340, textAlign: "center" }}>
        <div aria-hidden="true" style={{ fontSize: 64, marginBottom: 16 }}>⚠️</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>Erişim Hatası</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>{message}</p>
        <button type="button" onClick={() => window.location.reload()} className="btn btn-primary" style={{ padding: "12px 28px", borderRadius: 12 }}>
          Tekrar Dene
        </button>
      </div>
    </main>
  );
}
