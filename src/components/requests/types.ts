/** Garson talepleri sözleşmesi. Kaynak: /api/waiter/service-requests?status=active|completed */

import type { TableRefDTO } from "@/components/tables/types";
import type { RequestStatus, ServiceRequestType } from "@/contracts/requests";
import type { Money } from "@/lib/format";

export type { RequestStatus };
/** Talep türü (sözleşmede ServiceRequestType) */
export type RequestType = ServiceRequestType;

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
