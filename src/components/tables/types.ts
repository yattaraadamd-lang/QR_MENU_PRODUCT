/**
 * Masa ekranlarının API sözleşmesi (admin + garson). Kaynak: /api/admin/tables,
 * /api/waiter/tables, /api/bills/[sessionId]. Prisma Decimal JSON'da string gelir.
 */

import type { PaymentPayload } from "@/components/payments/paymentForm";
import type { PaymentMethod } from "@/components/payments/paymentMethods";
import type { Money } from "@/lib/format";

/** Ödeme, sipariş ve talep kayıtlarındaki masa özeti */
export interface TableRefDTO {
  readonly tableNumber: string;
  readonly tableName: string | null;
}

export type TableStatus =
  | "EMPTY"
  | "OCCUPIED"
  | "HAS_ORDER"
  | "PREPARING"
  | "SERVED"
  | "WAITING_WAITER"
  | "PAYMENT_REQUESTED"
  | "CLEANING_NEEDED";

export type BillPaymentStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID";

export interface TableBillDTO {
  readonly id: string;
  readonly totalAmount: Money;
  readonly paidAmount: Money;
  readonly remainingAmount: Money;
  readonly paymentStatus: BillPaymentStatus;
}

export interface ActiveSessionDTO {
  readonly id: string;
  readonly startedAt: string;
}

export interface TableOrderDTO {
  readonly id: string;
  readonly status: string;
}

export interface TableRequestDTO {
  readonly id: string;
  readonly status: string;
  readonly requestType: string;
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

export interface BillOrderItemDTO {
  readonly id: string;
  readonly productName: string;
  readonly quantity: number;
  readonly totalPrice: Money;
}

export interface BillOrderDTO {
  readonly id: string;
  readonly createdAt: string;
  readonly totalPrice: Money;
  readonly items: readonly BillOrderItemDTO[];
}

export interface BillPaymentDTO {
  readonly id: string;
  readonly method: PaymentMethod | null;
  readonly amount: Money;
  readonly handledByWaiterName: string | null;
}

export interface BillDetailDTO extends TableBillDTO {
  readonly tableSession: { readonly orders: readonly BillOrderDTO[] } | null;
  readonly payments: readonly BillPaymentDTO[];
}

export interface CollectPaymentInput extends PaymentPayload {
  readonly tableSessionId: string;
}
