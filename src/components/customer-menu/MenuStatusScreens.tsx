"use client";

// Sunucu sayfası da (menü alınamadığında) MenuAccessError'ı çizer; düğmesi tarayıcıda çalışır
import Loader from "@/components/ui/Loader";
import PixelMark from "@/components/brand/PixelMark";

export function MenuLoading() {
  return (
    <div className="customer-theme min-h-viewport" style={{ display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
      <Loader label="Menü hazırlanıyor" />
    </div>
  );
}

/** Menü alınamadı (geçersiz masa, ağ hatası): sayfanın tek başlığı */
export function MenuAccessError({ message }: { message: string }) {
  return (
    <main id="main-content" className="customer-theme min-h-viewport" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div role="alert" style={{ maxWidth: 340, textAlign: "center" }}>
        <PixelMark size={48} className="mx-auto mb-5" />
        <p className="eyebrow">Erişim hatası</p>
        <h1 className="font-display" style={{ fontSize: 34, lineHeight: 1.1, margin: "10px 0" }}>Menü açılamadı</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>{message}</p>
        <button type="button" onClick={() => window.location.reload()} className="btn btn-primary btn-lg">
          Tekrar dene
        </button>
      </div>
    </main>
  );
}
