import type { DecimalString, IsoDateTime } from "./common";
import type { OrderStatus } from "./orders";
import type { PaymentMethod } from "./payments";
import type { RequestStatus, ServiceRequestType } from "./requests";

/** Masa ekranlarının sözleşmesi (admin + garson). Eşleme: src/lib/api/tables.dto.ts */

export type TableStatus =
  | "EMPTY"
  | "OCCUPIED"
  | "HAS_ORDER"
  | "PREPARING"
  | "SERVED"
  | "WAITING_WAITER"
  | "PAYMENT_REQUESTED"
  | "CLEANING_NEEDED";

export type BillPaymentStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID" | "CANCELLED";

/** Masa numarası ve adının azami uzunluğu */
export const TABLE_LIMITS = { number: 50, name: 100 } as const;

export interface TableBillDTO {
  readonly id: string;
  readonly totalAmount: DecimalString;
  readonly paidAmount: DecimalString;
  readonly remainingAmount: DecimalString;
  readonly paymentStatus: BillPaymentStatus;
}

export interface ActiveSessionDTO {
  readonly id: string;
  readonly startedAt: IsoDateTime;
}

/** Masada süren sipariş (bekleyen, kabul edilen, hazırlanan) */
export interface TableOrderDTO {
  readonly id: string;
  readonly status: OrderStatus;
}

/** Masada açık talep (bekleyen, görülen, ilgilenilen) */
export interface TableRequestDTO {
  readonly id: string;
  readonly status: RequestStatus;
  readonly requestType: ServiceRequestType;
}

export interface TableDTO {
  readonly id: string;
  readonly tableNumber: string;
  readonly tableName: string | null;
  readonly status: TableStatus;
  readonly activeSession: ActiveSessionDTO | null;
  readonly bill: TableBillDTO | null;
  readonly orders: readonly TableOrderDTO[];
  readonly serviceRequests: readonly TableRequestDTO[];
}

/** GET /api/admin/tables ve GET /api/waiter/tables */
export interface TableListResponse {
  readonly tables: readonly TableDTO[];
}

export interface BillOrderItemDTO {
  readonly id: string;
  readonly productName: string;
  readonly quantity: number;
  readonly totalPrice: DecimalString;
}

export interface BillOrderDTO {
  readonly id: string;
  readonly createdAt: IsoDateTime;
  readonly totalPrice: DecimalString;
  readonly items: readonly BillOrderItemDTO[];
}

export interface BillPaymentDTO {
  readonly id: string;
  readonly method: PaymentMethod | null;
  readonly amount: DecimalString;
  readonly handledByWaiterName: string | null;
}

/** Oturumun adisyonu: ödenebilir siparişler ve alınmış ödemeler */
export interface BillDetailDTO extends TableBillDTO {
  readonly tableSession: { readonly orders: readonly BillOrderDTO[] };
  readonly payments: readonly BillPaymentDTO[];
}

/** GET /api/bills/[sessionId] */
export interface BillDetailResponse {
  readonly bill: BillDetailDTO;
}
