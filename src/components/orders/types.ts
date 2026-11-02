/** Sipariş sözleşmesi (garson + admin). Kaynak: /api/waiter/orders, /api/orders */

import type { TableRefDTO } from "@/components/pending-payments/types";
import type { Money } from "@/components/tables/types";

export type OrderStatus = "PENDING" | "ACCEPTED" | "PREPARING" | "SERVED" | "CANCELLED" | "REJECTED";

export type OrderPaymentStatus = "UNPAID" | "PAYMENT_REQUESTED" | "PAID" | "CANCELLED";

export interface OrderItemDTO {
  readonly id?: string;
  readonly productId?: string;
  readonly product?: { readonly id?: string; readonly name: string };
  readonly productName: string;
  readonly quantity: number;
  readonly unitPrice: Money;
  readonly totalPrice?: Money;
  readonly customerNote: string | null;
}

export interface OrderDTO {
  readonly id: string;
  readonly table: TableRefDTO;
  readonly totalPrice: Money;
  readonly note: string | null;
  readonly status: OrderStatus;
  /** Yalnız admin listesinde */
  readonly paymentStatus?: OrderPaymentStatus;
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

/** Red/iptal isteğinin ortak gövdesi (garson durum ucu ve admin iptal ucu) */
export interface CancelPayload {
  readonly reasonCode: CancelReasonCode;
  readonly cancelReason: string;
  readonly outOfStockProductIds: readonly string[] | null;
}
