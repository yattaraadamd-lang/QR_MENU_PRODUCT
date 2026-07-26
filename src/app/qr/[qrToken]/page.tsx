"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";

export default function QRTokenPage({ params }: { params: Promise<{ qrToken: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    resolveQRToken();
  }, []);

  const resolveQRToken = async () => {
    try {
      const response = await fetch(`/api/qr/${resolvedParams.qrToken}`);
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
      sessionStorage.setItem("qr_token", resolvedParams.qrToken);

      // ✅ CustomerSession oluştur — qrToken ile (QR tarama kanıtı)
      // Masa bazlı localStorage anahtarı kullan
      const storageKey = `qr_session_${bId}_${tId}`;
      const existingToken = localStorage.getItem(storageKey);

      try {
        const sessionRes = await fetch("/api/customer/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            businessId: bId,
            tableId: tId,
            qrToken: resolvedParams.qrToken,
            existingToken: existingToken || undefined,
          }),
        });
        const sessionData = await sessionRes.json();
        if (sessionRes.ok && sessionData.sessionToken) {
          localStorage.setItem(storageKey, sessionData.sessionToken);
          // Eski global anahtarı temizle
          localStorage.removeItem("qr_session_token");
          sessionStorage.removeItem("qr_session_token");
          sessionStorage.removeItem("qr_order_blocked_msg");
        } else if (sessionData.viewOnly && sessionData.message) {
          sessionStorage.setItem("qr_order_blocked_msg", sessionData.message);
        }
      } catch (e) {
        console.log("Session oluşturma hatası:", e);
      }

      // Menü sayfasına yönlendir
      router.replace(`/menu/${bId}/${tNum}`);
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
