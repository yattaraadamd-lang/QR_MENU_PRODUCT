import { apiRequest } from "@/lib/api-client";

/** GET /api/qr/[qrToken]: menüye yönlendirmek için gereken alanlar */
export interface QrLookupDTO {
  readonly business: { readonly id: string };
  readonly table: { readonly id: string; readonly tableNumber: string };
}

export function resolveQrToken(qrToken: string, signal?: AbortSignal) {
  return apiRequest<QrLookupDTO>(`/api/qr/${encodeURIComponent(qrToken)}`, {
    signal,
    fallbackError: "QR kod doğrulanamadı",
  });
}
