import { apiRequest } from "@/lib/api-client";
import type { BillingCustomer, SubscriptionData } from "./types";

export const SUBSCRIPTION_URL = "/api/admin/subscription";

/** useApiQuery `select`: uç veriyi doğrudan döner; eksik gövdede ekran hata durumuna düşer */
export function selectSubscription(json: unknown): SubscriptionData | null {
  const body = json as Partial<SubscriptionData> | null;
  return body?.usage && Array.isArray(body.plans) ? (body as SubscriptionData) : null;
}

export const subscriptionApi = {
  /** iyzico ödeme formunu başlatır; dönen içerik <script> olarak sayfaya eklenir */
  startCheckout: (planCode: string, customer: BillingCustomer) =>
    apiRequest<{ checkoutFormContent: string }>("/api/admin/billing/checkout", {
      method: "POST",
      body: { planCode, customer },
      fallbackError: "Ödeme başlatılamadı.",
    }),

  cancelPaid: () =>
    apiRequest<{ message?: string }>("/api/admin/billing/cancel", {
      method: "POST",
      fallbackError: "Abonelik iptal edilemedi.",
    }),
};
