/** Garson sipariş ekranına özgü tipler; sipariş sözleşmesi components/orders/types'ta */

import type { CancelPayload, OrderStatus } from "@/components/orders/types";

/** "active": bekleyen/kabul/hazırlanan · "completed": servis edilen/iptal */
export type OrderFilter = "active" | "completed";

/** PUT /api/waiter/orders/[id]/status gövdesi */
export type OrderStatusUpdate = { readonly status: OrderStatus } & Partial<CancelPayload>;
