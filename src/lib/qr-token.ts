/**
 * Masa QR token'ları
 *
 * 🔒 SECURITY: Eski biçim `qr_{slug}_{masaNo}_{8 hex}` idi — slug ve masa numarası
 * herkese açık olduğundan gizli kısım yalnız 32 bitti. Yeni token 128-bit CSPRNG;
 * işletme/masa bilgisi içermez. Mevcut (basılmış) QR'lar geçerli kalır.
 */

import crypto from "crypto";

export function generateQrToken(): string {
  return `qr_${crypto.randomBytes(16).toString("hex")}`;
}

/** Zamanlama saldırısına karşı sabit süreli karşılaştırma */
export function qrTokensMatch(provided: unknown, expected: string | null | undefined): boolean {
  if (typeof provided !== "string" || !provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
