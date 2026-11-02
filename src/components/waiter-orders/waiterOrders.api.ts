import { apiRequest } from "@/lib/api-client";
import type { OrderDTO, OrderFilter, OrderStatusUpdate } from "./types";

export const ordersUrl = (filter: OrderFilter) => `/api/waiter/orders?status=${filter}`;

/** useApiQuery `select`: uç `{ orders: [...] }` döner */
export function selectOrders(json: unknown): OrderDTO[] {
  const list = (json as { orders?: unknown } | null)?.orders;
  return Array.isArray(list) ? (list as OrderDTO[]) : [];
}

export const waiterOrdersApi = {
  updateStatus: (orderId: string, update: OrderStatusUpdate) =>
    apiRequest<unknown>(`/api/waiter/orders/${encodeURIComponent(orderId)}/status`, {
      method: "PUT",
      body: update,
      fallbackError: "İşlem başarısız oldu.",
    }),
};
