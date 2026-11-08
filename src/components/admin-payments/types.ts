/** Ödeme geçmişi sözleşmesi. Kaynak: /api/admin/payments */

import type { TableRefDTO } from "@/components/tables/types";
import type { Money } from "@/lib/format";

export type PaymentStatus =
  | "PENDING"
  | "AWAITING_ADMIN_APPROVAL"
  | "PROCESSING"
  | "PAID"
  | "REJECTED"
  | "CANCELLED"
  | "FAILED";

export interface PaymentRecordDTO {
  readonly id: string;
  readonly amount: Money;
  readonly receivedAmount: Money | null;
  readonly changeAmount: Money | null;
  readonly method: string | null;
  readonly status: PaymentStatus;
  readonly note: string | null;
  readonly rejectionReason: string | null;
  readonly requestedByName: string | null;
  readonly handledByWaiterName: string | null;
  readonly approvedByName: string | null;
  readonly paidAt: string | null;
  readonly createdAt: string;
  readonly table: TableRefDTO | null;
}

export type PaymentFilter = "ALL" | "AWAITING" | "COMPLETED" | "REJECTED";

/** Yerel takvim günleri "YYYY-AA-GG" (uçlar dahil) */
export interface DateRange {
  readonly start: string;
  readonly end: string;
}
