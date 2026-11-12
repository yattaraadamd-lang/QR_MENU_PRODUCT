/** Ödeme. Ödeme DTO'ları şimdilik özellik klasörlerinde. */

export type PaymentMethod = "CASH" | "CARD" | "ONLINE" | "OTHER";

/** Ödeme notu ve onay talebini reddetme nedeninin azami uzunluğu */
export const PAYMENT_LIMITS = { note: 500, rejectReason: 500 } as const;
