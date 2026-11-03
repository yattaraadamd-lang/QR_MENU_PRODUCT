/** Garson talepleri sözleşmesi. Kaynak: /api/waiter/service-requests?status=active|completed */

import type { TableRefDTO } from "@/components/pending-payments/types";
import type { Money } from "@/components/tables/types";

export type RequestType =
  | "CALL_WAITER"
  | "PAYMENT_REQUEST"
  | "HELP_REQUEST"
  | "CLEANING_REQUEST"
  | "ORDER_REQUEST"
  | "PRODUCT_INFO"
  | "COMPLAINT_SUGGESTION";

export type RequestStatus = "PENDING" | "SEEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

/** Masa açma isteğiyle gelen sepet önizlemesi (ORDER_REQUEST) */
export interface OrderPreviewDTO {
  readonly items?: readonly {
    readonly name: string;
    readonly quantity: number;
    readonly unitPrice: Money;
    readonly note?: string | null;
  }[];
  readonly total?: Money;
  readonly orderNote?: string | null;
}

export interface ServiceRequestDTO {
  readonly id: string;
  readonly tableId: string;
  readonly table: TableRefDTO;
  readonly requestType: RequestType;
  readonly status: RequestStatus;
  readonly note: string | null;
  readonly createdAt: string;
  /** Masa açma isteğinin geçerlilik süresi */
  readonly expiresAt: string | null;
  readonly orderPreview: OrderPreviewDTO | null;
}
