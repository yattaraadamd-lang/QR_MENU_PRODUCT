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
