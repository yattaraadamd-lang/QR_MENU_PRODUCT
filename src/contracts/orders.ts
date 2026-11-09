import type { DecimalString, IsoDateTime, TableRefDTO } from "./common";

/** Sipariş sözleşmesi (garson + admin). Eşleme: src/lib/api/orders.dto.ts */

export type OrderStatus = "PENDING" | "ACCEPTED" | "PREPARING" | "SERVED" | "CANCELLED" | "REJECTED";

export type OrderPaymentStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID" | "CANCELLED";

export type CancelReasonCode =
  | "OUT_OF_STOCK"
  | "CUSTOMER_CANCELLED"
  | "WRONG_ORDER"
  | "TABLE_NOT_VERIFIED"
  | "BUSINESS_NOT_ACCEPTING"
  | "OTHER";

export interface OrderItemDTO {
  readonly id: string;
  /** "Stokta yok" ile iptal ederken işaretlenecek ürün */
  readonly productId: string;
  readonly productName: string;
  readonly quantity: number;
  readonly unitPrice: DecimalString;
  readonly totalPrice: DecimalString;
  readonly customerNote: string | null;
}

export interface OrderDTO {
  readonly id: string;
  readonly table: TableRefDTO;
  readonly totalPrice: DecimalString;
  readonly note: string | null;
  readonly status: OrderStatus;
  readonly createdAt: IsoDateTime;
  /** İptal ya da red nedeni */
  readonly cancelReason: string | null;
  readonly waiter: { readonly id: string; readonly name: string } | null;
  readonly items: readonly OrderItemDTO[];
}

/** Admin listesi siparişin ödeme durumunu da taşır */
export interface AdminOrderDTO extends OrderDTO {
  readonly paymentStatus: OrderPaymentStatus;
}

/** GET /api/orders: işletmenin son 100 siparişi */
export interface AdminOrderListResponse {
  readonly orders: readonly AdminOrderDTO[];
}

/** GET /api/waiter/orders?status=active|completed */
export interface WaiterOrderListResponse {
  readonly orders: readonly OrderDTO[];
  readonly page: number;
  readonly limit: number;
}

/** Red/iptal isteğinin ortak gövdesi (garson durum ucu ve admin iptal ucu) */
export interface CancelPayload {
  readonly reasonCode: CancelReasonCode;
  readonly cancelReason: string;
  readonly outOfStockProductIds: readonly string[] | null;
}
