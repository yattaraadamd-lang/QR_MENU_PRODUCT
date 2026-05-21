"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function QRTokenPage({ params }: { params: { qrToken: string } }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    resolveQRToken();
  }, []);

  const resolveQRToken = async () => {
    try {
      const response = await fetch(`/api/qr/${params.qrToken}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "QR kod doğrulanamadı");
        setLoading(false);
        return;
      }

      // Masa ve işletme bilgilerini sessionStorage'a kaydet
      sessionStorage.setItem("qr_business", JSON.stringify(data.business));
      sessionStorage.setItem("qr_table", JSON.stringify(data.table));
      sessionStorage.setItem("qr_token", params.qrToken);

      // Menü sayfasına yönlendir
      router.replace(`/menu/${data.business.id}/${data.table.tableNumber}`);
    } catch (err) {
      setError("Bağlantı hatası. Lütfen tekrar deneyin.");
      setLoading(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#fafafa" }}>
        <div className="text-center max-w-sm">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-xl font-bold mb-2" style={{ color: "#0f172a" }}>
            QR Kod Geçersiz
          </h1>
          <p className="text-gray-500 mb-6">{error}</p>
          <button
            onClick={() => { setLoading(true); setError(null); resolveQRToken(); }}
            className="btn btn-primary"
          >
            Tekrar Dene
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#fafafa" }}>
      <div className="text-center">
        <div className="text-5xl mb-4 animate-pulse">📱</div>
        <p className="text-gray-500 font-medium">Menü yükleniyor...</p>
      </div>
    </div>
  );
}
