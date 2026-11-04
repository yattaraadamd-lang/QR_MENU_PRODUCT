"use client";

// Sunucu sayfası da (menü alınamadığında) MenuAccessError'ı çizer; düğmesi tarayıcıda çalışır
import BrandMark from "@/components/brand/BrandMark";
import Button from "@/components/ui/Button";
import Loader from "@/components/ui/Loader";

export function MenuLoading() {
  return (
    <div className="customer-theme min-h-viewport flex flex-col items-center justify-center gap-4">
      <Loader label="Menü hazırlanıyor" />
    </div>
  );
}

/** Menü alınamadı (geçersiz masa, ağ hatası): sayfanın tek başlığı */
export function MenuAccessError({ message }: { message: string }) {
  return (
    <main id="main-content" className="customer-theme min-h-viewport flex items-center justify-center p-6">
      <div role="alert" className="max-w-[340px] text-center">
        <BrandMark size={48} className="mx-auto mb-5" />
        <p className="eyebrow">Erişim hatası</p>
        <h1 className="font-display my-2.5 text-[34px] leading-[1.1]">Menü açılamadı</h1>
        <p className="mb-6 text-sm leading-relaxed text-fg-secondary">{message}</p>
        <Button size="lg" onClick={() => window.location.reload()}>
          Tekrar dene
        </Button>
      </div>
    </main>
  );
}
