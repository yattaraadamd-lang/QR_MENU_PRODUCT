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
 * - SWR/Polling fallback when WebSocket is unavailable
 * - Connection status events for UI toast notifications
 */

// Singleton socket instance
let socket: Socket | null = null;
// Guard: prevent parallel TOKEN_EXPIRED refresh loops
let tokenRefreshInProgress = false;
// Polling fallback state
let pollingInterval: ReturnType<typeof setInterval> | null = null;
let pollingCallback: (() => void) | null = null;

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
 * Start SWR/Polling fallback — polls every 5 seconds when socket is down.
 */
function startPollingFallback(callback: () => void) {
  stopPollingFallback();
  pollingCallback = callback;
  pollingInterval = setInterval(() => {
    if (pollingCallback) pollingCallback();
  }, 5000);
  // Fire immediately on start
  callback();
}

/**
 * Stop polling fallback.
 */
function stopPollingFallback() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  pollingCallback = null;
}

/**
 * Check if polling is currently active.
 */
export function isPollingActive(): boolean {
  return pollingInterval !== null;
}

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

    // ✅ Connection status events for UI
    socket.on("disconnect", (reason) => {
      console.warn("[Socket] Disconnected:", reason);
      window.dispatchEvent(
        new CustomEvent("socket-connection-status", {
          detail: { connected: false, reason },
        })
      );
    });

    socket.on("connect", () => {
      console.log("[Socket] Connected");
      // Stop polling when socket reconnects
      stopPollingFallback();
      window.dispatchEvent(
        new CustomEvent("socket-connection-status", {
          detail: { connected: true },
        })
      );
    });
  }

  return socket;
}

/**
 * ✅ P0-03 FIX: Kimlikli bağlantı; sunucu kullanıcıyı auth'tan bildiği işletme odasına
 * (yeniden bağlanınca da) kendiliğinden katar, "join_business" gerekmez.
 *
 * İşletme odasına abone ol: `handlers` olay → işleyici. `onReconnect` verilirse yeniden
 * bağlanınca ve bağlantı yokken (yedek polling) çağrılır. Dönen fonksiyon yalnız bu
 * aboneliğin dinleyicilerini kaldırır. Eski connectToBusinessRoom her çağrıda yeni
 * connect/disconnect dinleyicisi ekleyip kaldıramadığından ekran her yeniden abone
 * olduğunda (oturum yenilenmesi, filtre, sayfa geçişi) dinleyiciler birikiyordu.
 */
export function subscribeToBusinessRoom(
  authToken: string,
  handlers: Record<string, (data: any) => void>,
  onReconnect?: () => void
): () => void {
  if (!authToken) {
    throw new Error("Authentication token required for socket connection");
  }

  const s = getSocket(authToken);
  if (!s.connected) {
    s.auth = { token: authToken };
    s.io.opts.reconnection = true;
    s.connect();
  }

  const handleConnect = () => {
    stopPollingFallback();
    onReconnect?.();
  };
  const handleDisconnect = () => {
    if (onReconnect) startPollingFallback(onReconnect);
  };

  s.on("connect", handleConnect);
  s.on("disconnect", handleDisconnect);
  Object.entries(handlers).forEach(([ev, fn]) => s.on(ev, fn));

  return () => {
    s.off("connect", handleConnect);
    s.off("disconnect", handleDisconnect);
    Object.entries(handlers).forEach(([ev, fn]) => s.off(ev, fn));
    // Bu aboneliğin başlattığı yedek polling ayrılmış ekran için çalışmaya devam etmesin
    if (onReconnect && pollingCallback === onReconnect) stopPollingFallback();
  };
}

/**
 * Socket bağlantısını kapat ve instance'ı sıfırla.
 * Kullanıcı logout olunca çağrılmalı.
 */
export function disconnectSocket(): void {
  stopPollingFallback();
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  tokenRefreshInProgress = false;
}
