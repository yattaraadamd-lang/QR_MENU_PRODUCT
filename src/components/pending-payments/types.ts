/** Admin "bekleyen ödemeler" sözleşmesi. Kaynak: /api/admin/pending-payments, /api/admin/payments */

import type { Money } from "@/components/tables/types";

export interface TableRefDTO {
  readonly tableNumber: string;
  readonly tableName: string | null;
}

/** Açık adisyon (doğrudan tahsilat) */
export interface OpenBillDTO {
  readonly id: string;
  readonly totalAmount: Money;
  readonly paidAmount: Money;
  readonly remainingAmount: Money;
  readonly table: TableRefDTO;
}

/** Garson/müşteri ödeme bildirimi: admin onaylayınca tahsil edilir */
export interface PaymentRequestDTO {
  readonly id: string;
  readonly amount: Money;
  readonly receivedAmount: Money | null;
  readonly changeAmount: Money | null;
  readonly method: string | null;
  readonly note: string | null;
  readonly status: string;
  readonly requestedByName: string | null;
  readonly table: TableRefDTO;
}
