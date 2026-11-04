"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { resolveQrToken, type QrLookupDTO } from "./qr.api";

/**
 * Menü sayfası oturumu bu işaretlerle kurar: qr_token QR tarama kanıtı, qr_fresh_scan yeni
 * tarama. CustomerSession burada beklenmez: menüyü bir istek geciktiriyordu.
 */
function rememberScan(qrToken: string, tableId: string) {
  try {
    sessionStorage.setItem("qr_token", qrToken);
    sessionStorage.setItem("qr_fresh_scan", tableId);
  } catch {
    // Depolama kapalı (gizli pencere, engelli site verisi): kod geçerli, menüye yine gidilir
  }
}

/** QR kodunu doğrular ve menüye yönlendirir; hata varsa ekran mesajı ve "Tekrar dene" gösterir */
export function useQrRedirect(qrToken: string) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const redirect = useCallback(
    ({ business, table }: QrLookupDTO) => {
      rememberScan(qrToken, table.id);
      router.replace(`/menu/${business.id}/${encodeURIComponent(table.tableNumber)}`);
    },
    [qrToken, router],
  );

  const resolve = useCallback(
    async (signal?: AbortSignal) => {
      setError(null);
      const result = await resolveQrToken(qrToken, signal);
      if (result.ok) redirect(result.data);
      else if (!result.aborted) setError(result.error);
    },
    [qrToken, redirect],
  );

  useEffect(() => {
    const controller = new AbortController();
    void resolve(controller.signal);
    return () => controller.abort();
  }, [resolve]);

  return { error, retry: () => void resolve() };
}
