import { apiRequest } from "@/lib/api-client";
import { randomId } from "@/lib/uuid";
import type { PaymentPayload } from "@/components/payments/paymentForm";
import type { OpenBillDTO, PaymentRequestDTO } from "./types";

/** Admin onayı bekleyen durumlar */
const AWAITING_APPROVAL = new Set(["PENDING", "AWAITING_ADMIN_APPROVAL"]);

const id = (value: string) => encodeURIComponent(value);

function listOf<T>(json: unknown, key: string): T[] {
  const list = (json as Record<string, unknown> | null)?.[key];
  return Array.isArray(list) ? (list as T[]) : [];
}

export const selectOpenBills = (json: unknown) => listOf<OpenBillDTO>(json, "bills");

export const selectApprovalRequests = (json: unknown) =>
  listOf<PaymentRequestDTO>(json, "payments").filter((p) => AWAITING_APPROVAL.has(p.status));

interface PaymentResult {
  readonly changeAmount?: number | string | null;
}

export const pendingPaymentsApi = {
  /** Bildirilen tutarı olduğu gibi tahsil eder (her onay yeni idempotency anahtarı) */
  approve: (request: PaymentRequestDTO) =>
    apiRequest<PaymentResult>(`/api/admin/payments/${id(request.id)}/approve`, {
      method: "POST",
      body: {
        amount: Number(request.amount),
        method: request.method || "CASH",
        receivedAmount: request.receivedAmount ? Number(request.receivedAmount) : null,
        note: request.note,
        idempotencyKey: randomId(),
      },
      fallbackError: "Ödeme onaylanamadı.",
    }),

  reject: (requestId: string, reason: string) =>
    apiRequest<unknown>(`/api/admin/payments/${id(requestId)}/reject`, {
      method: "POST",
      body: { reason: reason.trim() || null },
      fallbackError: "Talep reddedilemedi.",
    }),

  /** Anahtar pencere açılınca bir kez üretilir: çift tıklama/yeniden deneme tek tahsilat olur */
  payBill: (billId: string, payment: PaymentPayload, idempotencyKey: string) =>
    apiRequest<PaymentResult>(`/api/admin/pending-payments/${id(billId)}/pay`, {
      method: "POST",
      body: {
        amount: payment.amount,
        method: payment.method,
        receivedAmount: payment.receivedAmount,
        idempotencyKey,
      },
      fallbackError: "Ödeme işlemi başarısız.",
    }),
};
