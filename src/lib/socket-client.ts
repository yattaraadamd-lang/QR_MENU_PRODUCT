"use client";

import { io, Socket } from "socket.io-client";
import { getSessionToken } from "./get-session-token";

/**
 * 🔒 SECURITY FIX P0-03: Socket.IO Client with Authentication
 *
 * CHANGES:
 * - JWT token passed in handshake auth
 * - Token obtained from NextAuth session
 * - Fatal auth errors stop reconnection immediately
 * - TOKEN_EXPIRED triggers single controlled refresh
 * - No client-controlled businessId
 */

// Singleton socket instance
let socket: Socket | null = null;
// Guard: prevent parallel TOKEN_EXPIRED refresh loops
let tokenRefreshInProgress = false;

/**
 * Fatal auth error codes — reconnecting with the same broken token is pointless.
 */
const FATAL_AUTH_CODES = new Set([
  "NO_TOKEN",
  "INVALID_TOKEN",
  "INVALID_TOKEN_FORMAT",
  "INVALID_SIGNATURE",
  "INVALID_TOKEN_PAYLOAD",
  "USER_DISABLED",
  "USER_NOT_FOUND",
  "BUSINESS_MISMATCH",
  "ROLE_MISMATCH",
  "SERVER_CONFIG_ERROR",
]);

/**
 * Socket instance'ını döndürür. İlk çağrıda oluşturur.
 *
 * ✅ P0-03 FIX: Requires authentication token in handshake
 *
 * @param authToken NextAuth access token (required)
 * @returns Socket instance
 */
export function getSocket(authToken?: string): Socket {
  if (!socket) {
    const url = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;

    socket = io(url, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      randomizationFactor: 0.3,
      timeout: 20000,
      // ✅ P0-03 FIX: Pass authentication token in handshake
      auth: authToken ? { token: authToken } : undefined,
    });

    // ✅ Handle authentication errors
    socket.on("connect_error", async (error: any) => {
      const code = error?.data?.code as string | undefined;
      console.error("[Socket] Connection error:", error?.message || error);

      // ── Fatal auth errors: stop reconnecting with the same broken token
      if (code && FATAL_AUTH_CODES.has(code)) {
        if (socket) {
          socket.io.opts.reconnection = false;
          socket.disconnect();
        }
        window.dispatchEvent(
          new CustomEvent("socket-auth-failed", { detail: { code } })
        );
        return;
      }

      // ── TOKEN_EXPIRED: try one controlled refresh
      if (code === "TOKEN_EXPIRED" && !tokenRefreshInProgress) {
        tokenRefreshInProgress = true;

        if (socket) {
          socket.io.opts.reconnection = false;
          socket.disconnect();
        }

        try {
          const newToken = await getSessionToken();
          if (newToken && socket) {
            socket.auth = { token: newToken };
            socket.io.opts.reconnection = true;
            socket.connect();
          }
          // If still fails on next connect_error it will fall through to
          // FATAL or another TOKEN_EXPIRED, which is guarded by the flag.
        } catch {
          // getSession failed — nothing more we can do
        } finally {
          tokenRefreshInProgress = false;
        }
        return;
      }
    });
  }

  return socket;
}

/**
 * ✅ P0-03 FIX: Connect with authentication
 *
 * İşletme odasına bağlan (businessId server tarafından auth'dan alınır).
 * Bağlantı kesilip tekrar kurulduğunda (reconnect) `onReconnect` callback'i çağrılır.
 *
 * @param authToken     NextAuth access token (required for authentication)
 * @param onReconnect   Bağlantı yeniden kurulunca çağrılacak fonksiyon (opsiyonel)
 * @returns socket instance
 */
export function connectToBusinessRoom(
  authToken: string,
  onReconnect?: () => void
): Socket {
  if (!authToken) {
    throw new Error("Authentication token required for socket connection");
  }

  const s = getSocket(authToken);

  if (!s.connected) {
    // ✅ Update auth token before connecting (in case it was refreshed)
    s.auth = { token: authToken };
    // Ensure reconnection is enabled for a fresh connect attempt
    s.io.opts.reconnection = true;
    s.connect();
  }

  // ✅ P0-03 FIX: Server will automatically join user to their business room
  // No need to emit "join_business" - server knows businessId from auth

  // Reconnect sonrası otomatik veri senkronize et
  const handleReconnect = () => {
    // ✅ Server auto-joins on reconnect, just refresh data
    if (typeof onReconnect === "function") {
      onReconnect();
    }
  };

  // Önceki listener'ı temizle (aynı event birden fazla kayıt olmasın)
  s.off("connect", handleReconnect);
  s.on("connect", handleReconnect);

  return s;
}

/**
 * Socket bağlantısını kapat ve instance'ı sıfırla.
 * Kullanıcı logout olunca çağrılmalı.
 */
export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  tokenRefreshInProgress = false;
}
