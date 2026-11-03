import type { PaymentRecordDTO } from "./types";

/** İşletmenin tüm ödeme kayıtları (yeniden eskiye); filtreleme istemcide */
export const PAYMENTS_URL = "/api/admin/payments";

export function selectPaymentRecords(json: unknown): PaymentRecordDTO[] {
  const list = (json as { payments?: unknown } | null)?.payments;
  return Array.isArray(list) ? (list as PaymentRecordDTO[]) : [];
}
