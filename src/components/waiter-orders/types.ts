/** Garson sipariş ekranı sözleşmesi. Kaynak: /api/waiter/orders?status=active|completed */

import type { TableRefDTO } from "@/components/pending-payments/types";
import type { Money } from "@/components/tables/types";

export type OrderStatus = "PENDING" | "ACCEPTED" | "PREPARING" | "SERVED" | "CANCELLED" | "REJECTED";

/** "active": bekleyen/kabul/hazırlanan · "completed": servis edilen/iptal */
export type OrderFilter = "active" | "completed";

export interface OrderItemDTO {
  readonly id?: string;
  readonly productId?: string;
  readonly product?: { readonly id?: string; readonly name: string };
  readonly productName: string;
  readonly quantity: number;
  readonly unitPrice: Money;
  readonly customerNote: string | null;
}

export interface OrderDTO {
  readonly id: string;
  readonly table: TableRefDTO;
  readonly totalPrice: Money;
  readonly note: string | null;
  readonly status: OrderStatus;
  readonly createdAt: string;
  readonly cancelReason: string | null;
  readonly waiter: { readonly id: string; readonly name: string } | null;
  readonly items: readonly OrderItemDTO[];
}

export type CancelReasonCode =
  | "OUT_OF_STOCK"
  | "CUSTOMER_CANCELLED"
  | "WRONG_ORDER"
  | "TABLE_NOT_VERIFIED"
  | "BUSINESS_NOT_ACCEPTING"
  | "OTHER";

export interface OrderStatusUpdate {
  readonly status: OrderStatus;
  readonly cancelReason?: string;
  readonly reasonCode?: CancelReasonCode;
  readonly outOfStockProductIds?: readonly string[] | null;
}
