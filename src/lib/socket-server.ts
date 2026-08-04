/**
 * socket-server.ts — API route'larından Socket.IO emit helper
 *
 * server.js global.__socketIO üzerinden io instance'ını paylaşır.
 * Vercel/serverless ortamında io yoktur → emit sessizce atlanır (polling yeterlidir).
 */

declare global {
  // eslint-disable-next-line no-var
  var __socketIO: import("socket.io").Server | undefined;
}

/**
 * Belirli bir işletmenin room'una event gönderir.
 * businessId izolasyonu garantilidir — başka işletmelerin room'larına emit yapılamaz.
 */
export function emitToBusinessRoom(
  businessId: string,
  event: string,
  data: unknown
): void {
  if (!businessId || typeof businessId !== "string") {
    console.warn(`[Socket] emitToBusinessRoom: invalid businessId`);
    return;
  }

  const io = global.__socketIO;
  if (!io) {
    // Vercel serverless veya server.js çalışmıyorsa beklenen durum
    // Polling bu durumu telafi eder
    return;
  }

  try {
    const room = `business_${businessId}`;
    const payload =
      data !== null && typeof data === "object"
        ? { ...(data as Record<string, unknown>), _businessId: businessId, _ts: Date.now() }
        : { data, _businessId: businessId, _ts: Date.now() };
    io.to(room).emit(event, payload);

    if (process.env.NODE_ENV === "development") {
      console.log(`[Socket] "${event}" → ${room}`);
    }
  } catch (err) {
    // Emit hatası sistemi durdurmamalı
    console.error(`[Socket] emit error for "${event}":`, err);
  }
}

/**
 * Standardize edilmiş event isimleri.
 * API route'larında string literal yerine bu sabitleri kullanın.
 */
export const SOCKET_EVENTS = {
  NEW_ORDER:            "new_order",
  ORDER_STATUS_UPDATE:  "order_status_update",
  ORDER_CANCELLED:      "order_cancelled",
  CALL_WAITER:          "call_waiter",
  PAYMENT_REQUEST:      "payment_request",
  PAYMENT_COLLECTED:    "payment_collected",
  SERVICE_REQUEST:      "service_request",
  HELP_REQUEST:         "help_request",
  TABLE_UPDATED:        "table_updated",
  TABLE_OPENED:         "table_opened",
  TABLE_STATUS_UPDATE:  "table_status_update",
  SESSION_AUTHORIZED:   "session_authorized",
  ORDER_REQUEST_UPDATE: "order_request_update",
  PRODUCT_STOCK_UPDATED: "product_stock_updated",
  BILL_UPDATED:          "bill_updated",
} as const;

export type SocketEvent = typeof SOCKET_EVENTS[keyof typeof SOCKET_EVENTS];
