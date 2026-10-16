/**
 * Garson Davetleri — kod üretimi, hash ve davet linki
 *
 * - Ham kod yalnızca oluşturma anında döner; veritabanında SHA-256 hash'i tutulur.
 * - Davet linki: {APP_URL}/auth/join/{kod} — garson kod yazmadan kayıt olur.
 * - Tek kullanımlık, 7 gün geçerli.
 */

import crypto from "crypto";

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** 128-bit CSPRNG davet kodu (eski kodlarla aynı biçim: inv_ + 32 hex) */
export function generateInviteCode(): string {
  return `inv_${crypto.randomBytes(16).toString("hex")}`;
}

export function hashInviteCode(rawCode: string): string {
  return crypto.createHash("sha256").update(rawCode.trim()).digest("hex");
}

export function buildInviteUrl(rawCode: string, origin?: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || origin || "").replace(/\/+$/, "");
  return `${base}/auth/join/${encodeURIComponent(rawCode)}`;
}

/** Garson linki yapıştırırsa koddan önceki kısmı ayıklar */
export function extractInviteCode(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/auth\/join\/([^/?#\s]+)/);
  return match ? decodeURIComponent(match[1]) : trimmed;
}
