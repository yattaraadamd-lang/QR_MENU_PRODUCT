import { apiRequest } from "@/lib/api-client";
import type { CancelPayload, OrderDTO } from "@/components/orders/types";

/** İşletme oturumdan okunur; son 100 sipariş */
export const ADMIN_ORDERS_URL = "/api/orders";

export function selectAdminOrders(json: unknown): OrderDTO[] {
  const list = (json as { orders?: unknown } | null)?.orders;
  return Array.isArray(list) ? (list as OrderDTO[]) : [];
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
