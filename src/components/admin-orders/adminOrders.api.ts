import { apiRequest } from "@/lib/api-client";
import type { AdminOrderDTO, AdminOrderListResponse, CancelPayload } from "@/components/orders/types";

/** İşletme oturumdan okunur; son 100 sipariş */
export const ADMIN_ORDERS_URL = "/api/orders";

/** useApiQuery `select`: anahtar sözleşmeden okunur, değer doğrulanmaz (sunucu sözleşmeyle döner) */
export function selectAdminOrders(json: unknown): AdminOrderDTO[] {
  const list = (json as Partial<Record<keyof AdminOrderListResponse, unknown>> | null)?.orders;
  return Array.isArray(list) ? (list as AdminOrderDTO[]) : [];
}

export const adminOrdersApi = {
  /** CancelOrderDialog eylemi: admin her aktif siparişi iptal edebilir */
  cancel: (orderId: string, payload: CancelPayload) =>
    apiRequest<unknown>(`/api/admin/orders/${encodeURIComponent(orderId)}/cancel`, {
      method: "PUT",
      body: payload,
      fallbackError: "İptal edilemedi.",
    }),
};
