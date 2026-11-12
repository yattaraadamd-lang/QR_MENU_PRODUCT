/** Masa talepleri. Talep DTO'su şimdilik components/requests/types.ts'te. */

export type ServiceRequestType =
  | "CALL_WAITER"
  | "ORDER_REQUEST"
  | "PRODUCT_INFO"
  | "PAYMENT_REQUEST"
  | "CLEANING_REQUEST"
  | "HELP_REQUEST"
  | "COMPLAINT_SUGGESTION";

export type RequestStatus = "PENDING" | "SEEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

/** Müşteri talebi: neden (ör. garson çağırma açıklaması) ve notun azami uzunluğu */
export const SERVICE_REQUEST_LIMITS = { reason: 200, note: 500 } as const;

/** Masa etkinliği işaretleri: açık talep türleri; garson çağrısı ile ödeme talebi birbirini engeller */
export type ActiveRequestFlag = ServiceRequestType | "CALL_WAITER_BLOCKED" | "PAYMENT_REQUEST_BLOCKED";

/** Oturumun garson onayı bekleyen sipariş talebi: müşteri doğrulama kodunu garsona söyler */
export interface PendingOrderRequestDetail {
  readonly verificationCode: string | null;
  /** ISO tarih */
  readonly expiresAt: string | null;
  readonly status: RequestStatus;
}

/**
 * GET /api/customer/active-requests: müşteri menüsünün masa etkinliği. Ayrıntı yalnız isteği
 * yapan (oturum belirteci doğrulanan) oturumun bekleyen sipariş talebi için döner.
 */
export interface ActiveRequestsResponse {
  readonly activeRequests: Readonly<Partial<Record<ActiveRequestFlag, boolean>>>;
  readonly requestDetails: { readonly ORDER_REQUEST?: PendingOrderRequestDetail };
}
