import { apiRequest } from "@/lib/api-client";
import type { PaymentPayload } from "@/components/payments/paymentForm";
import type { WaiterPaymentDTO } from "./types";

/** useApiQuery `select`: uç `{ payments: [...] }` döner (bekleyen, onayda, reddedilen) */
export function selectWaiterPayments(json: unknown): WaiterPaymentDTO[] {
  const list = (json as { payments?: unknown } | null)?.payments;
  return Array.isArray(list) ? (list as WaiterPaymentDTO[]) : [];
}

export const waiterPaymentsApi = {
  /** Garson tahsil ettiğini bildirir; ciroya admin onayından sonra yansır */
  requestApproval: (paymentId: string, payment: PaymentPayload) =>
    apiRequest<unknown>(`/api/waiter/payments/${encodeURIComponent(paymentId)}/request-approval`, {
      method: "POST",
      body: payment,
      fallbackError: "Onay talebi gönderilemedi. Lütfen tekrar deneyin.",
    }),
};
