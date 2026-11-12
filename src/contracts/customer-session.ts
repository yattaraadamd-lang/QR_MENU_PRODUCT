/** Müşteri cihaz oturumu: masa güveninin canonical yetki durumu */

export type CustomerAuthorizationStatus = "VIEW_ONLY" | "PENDING" | "AUTHORIZED" | "REVOKED";

/** Cihaz engelini kaldırırken yazılan notun azami uzunluğu */
export const ACCESS_BLOCK_LIMITS = { note: 500 } as const;
