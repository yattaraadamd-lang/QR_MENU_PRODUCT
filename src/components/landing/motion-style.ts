import type { CSSProperties } from "react";

/**
 * Hareket gecikmesi stilleri. Saf fonksiyonlar: sunucu bileşenleri de çağırır
 * ("use client" dosyasındaki bir fonksiyon sunucudan çağrılamaz).
 */

/** İlk ekran CSS giriş animasyonunun gecikmesi (globals.css .enter-*): sırayla gelme */
export const enterDelay = (seconds: number) => ({ "--enter-delay": `${seconds}s` }) as CSSProperties;

/** RevealGroup çocuğunun sırası: gecikme = sıra × grubun gap'i */
export const revealIndex = (i: number) => ({ "--i": i }) as CSSProperties;
