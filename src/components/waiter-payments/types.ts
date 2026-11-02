/** Garson "ödeme talepleri" sözleşmesi. Kaynak: /api/waiter/payments */

import type { TableRefDTO } from "@/components/pending-payments/types";
import type { Money } from "@/components/tables/types";

/** PENDING: müşteri istedi · AWAITING_ADMIN_APPROVAL: garson gönderdi · REJECTED: admin reddetti */
export type WaiterPaymentStatus = "PENDING" | "AWAITING_ADMIN_APPROVAL" | "REJECTED";

export interface WaiterPaymentDTO {
  readonly id: string;
  readonly amount: Money;
  readonly receivedAmount: Money | null;
  readonly method: string | null;
  readonly note: string | null;
  readonly status: WaiterPaymentStatus;
  readonly rejectionReason: string | null;
  readonly requestedByName: string | null;
  readonly requestedAt: string | null;
  readonly createdAt: string;
  readonly table: TableRefDTO;
  readonly bill: { readonly remainingAmount: Money } | null;
}
