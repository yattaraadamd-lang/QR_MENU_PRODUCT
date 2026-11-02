import { apiRequest } from "@/lib/api-client";
import type { CancelPayload, OrderDTO } from "@/components/orders/types";
import type { OrderFilter, OrderStatusUpdate } from "./types";

export const ordersUrl = (filter: OrderFilter) => `/api/waiter/orders?status=${filter}`;

/** useApiQuery `select`: uç `{ orders: [...] }` döner */
export function selectOrders(json: unknown): OrderDTO[] {
  const list = (json as { orders?: unknown } | null)?.orders;
  return Array.isArray(list) ? (list as OrderDTO[]) : [];
}

const updateStatus = (orderId: string, update: OrderStatusUpdate) =>
  apiRequest<unknown>(`/api/waiter/orders/${encodeURIComponent(orderId)}/status`, {
    method: "PUT",
    body: update,
    fallbackError: "İşlem başarısız oldu.",
  });

export const waiterOrdersApi = {
  updateStatus,
  /** Bekleyen siparişi reddet (CancelOrderDialog eylemi) */
  reject: (orderId: string, payload: CancelPayload) => updateStatus(orderId, { status: "REJECTED", ...payload }),
  /** Kabul edilmiş/hazırlanan siparişi iptal et */
  cancel: (orderId: string, payload: CancelPayload) => updateStatus(orderId, { status: "CANCELLED", ...payload }),
};
