/**
 * Masa ekranlarının tipleri (admin + garson). API sözleşmesi src/contracts/tables.ts'te; sunucu
 * aynı tiplerle döner (src/lib/api/tables.dto.ts). Burada yalnız istemciye özgü tipler tanımlanır.
 */

import type { PaymentPayload } from "@/components/payments/paymentForm";

export type { TableRefDTO } from "@/contracts/common";
export type {
  BillDetailDTO,
  BillDetailResponse,
  BillPaymentStatus,
  TableBillDTO,
  TableDTO,
  TableListResponse,
  TableStatus,
} from "@/contracts/tables";

export interface CollectPaymentInput extends PaymentPayload {
  readonly tableSessionId: string;
}
