"use client";

import { useCallback, useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Loader from "@/components/ui/Loader";

export default function QRTokenPage({ params }: { params: Promise<{ qrToken: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const qrToken = resolvedParams.qrToken;

  const resolveQRToken = useCallback(async () => {
    try {
      const response = await fetch(`/api/qr/${qrToken}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "QR kod doğrulanamadı");
        setLoading(false);
        return;
      }

      const bId = data.business.id;
      const tId = data.table.id;
      const tNum = data.table.tableNumber;

      // Masa ve işletme bilgilerini sessionStorage'a kaydet
      sessionStorage.setItem("qr_business", JSON.stringify(data.business));
      sessionStorage.setItem("qr_table", JSON.stringify(data.table));
      sessionStorage.setItem("qr_token", qrToken);

      // ✅ CustomerSession burada beklenmez: menü sayfası bu işareti görünce oturumu qrToken
      // (QR tarama kanıtı) ile kurar/tazeler. Burada beklemek menüyü bir istek geciktiriyordu.
      sessionStorage.setItem("qr_fresh_scan", tId);

      // Menü sayfasına yönlendir
      router.replace(`/menu/${bId}/${encodeURIComponent(tNum)}`);
    } catch (err) {
      setError("Bağlantı hatası. Lütfen tekrar deneyin.");
      setLoading(false);
    }
  }, [qrToken, router]);

  useEffect(() => {
    resolveQRToken();
  }, [resolveQRToken]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#FFF8F1" }}>
        <div className="text-center max-w-sm">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-xl font-bold mb-2" style={{ color: "#2A1A12" }}>
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
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#FFF8F1" }}>
      <div className="text-center">
        
        <Loader label="Menü hazırlanıyor" emoji="🍽️" />
      </div>
    </div>
  );
}
