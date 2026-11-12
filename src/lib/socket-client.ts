"use client";

import { io, Socket } from "socket.io-client";
import { getSessionToken } from "./get-session-token";
import { reportClientError } from "./report-error";

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
  "SESSION_REVOKED",
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
 * Sunucu ara katmanının reddettiği bağlantıdaki kod: `next(err)` ile gelen hatanın `data.code`'u
 * (socket-auth-runtime.cjs). Başka bağlantı hatalarında (ağ, zaman aşımı) yoktur.
 */
function connectErrorCode(error: Error): string | undefined {
  const data: unknown = "data" in error ? error.data : undefined;
  if (typeof data !== "object" || data === null || !("code" in data)) return undefined;
  return typeof data.code === "string" ? data.code : undefined;
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
    socket.on("connect_error", async (error: Error) => {
      const code = connectErrorCode(error);
      console.error("[Socket] Connection error:", error.message || error);

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
        } catch (error) {
          // Oturum okunamadı: bağlantı yeniden kurulmaz. Yutulmaz; FATAL koduyla aynı olay yayılır
          reportClientError("socket.token-refresh", error);
          window.dispatchEvent(new CustomEvent("socket-auth-failed", { detail: { code: "TOKEN_REFRESH_FAILED" } }));
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
 * Abone olunduğunda bağlantı yoksa bu süre içinde gelen ilk bağlantıda ekran yenilenmez
 * (createConnectGate). Sayfa açılışıyla soketin odaya katılması arasında kaçabilecek olayı
 * ekranların 5–10 sn'lik yoklaması kapatır. Daha geç kurulan ilk bağlantıda (bağlantı hataları,
 * yeniden denemeler) olay kaçmış olabilir: o zaman yenilenir.
 */
const FIRST_CONNECT_GRACE_MS = 2000;

/**
 * Bir soket aboneliğinde "connect" olayının ekranı yenilemesi gerekip gerekmediği (FE-ARCH-3.5).
 * Abone olunduğunda bağlantı yoksa, `graceMs` içinde gelen ilk bağlantı sayfanın ilk yüklemesiyle
 * aynı anı görür: yenileme, ekranın az önce çektiği listeyi ikinci kez ister. Sonraki her bağlantı
 * ve geç kurulan ilk bağlantı yeniden bağlanmadır: arada kaçan olaylar için yenilenir.
 * Döndürülen işlev her "connect" olayında bir kez çağrılır.
 */
export function createConnectGate(connectedAtSubscribe: boolean, graceMs: number, now: () => number = Date.now) {
  const subscribedAt = now();
  let awaitingFirstConnect = !connectedAtSubscribe;
  return (): boolean => {
    const isInitialConnect = awaitingFirstConnect && now() - subscribedAt < graceMs;
    awaitingFirstConnect = false;
    return !isInitialConnect;
  };
}

/**
 * ✅ P0-03 FIX: Kimlikli bağlantı; sunucu kullanıcıyı auth'tan bildiği işletme odasına
 * (yeniden bağlanınca da) kendiliğinden katar, "join_business" gerekmez.
 *
 * İşletme odasına abone ol: `handlers` olay → işleyici. `onReconnect` verilirse yeniden
 * bağlanınca ve bağlantı yokken (yedek polling) çağrılır; sayfa açılırken kurulan ilk
 * bağlantıda çağrılmaz (FIRST_CONNECT_GRACE_MS). Dönen fonksiyon yalnız bu aboneliğin
 * dinleyicilerini kaldırır. Eski connectToBusinessRoom her çağrıda yeni connect/disconnect
 * dinleyicisi ekleyip kaldıramadığından ekran her yeniden abone olduğunda (oturum
 * yenilenmesi, filtre, sayfa geçişi) dinleyiciler birikiyordu.
 */
export function subscribeToBusinessRoom(
  authToken: string,
  /** Olay verisi sunucudan gelir ve doğrulanmamıştır: işleyici kullanmadan önce daraltır */
  handlers: Record<string, (data: unknown) => void>,
  onReconnect?: () => void
): () => void {
  if (!authToken) {
    throw new Error("Authentication token required for socket connection");
  }

  const s = getSocket(authToken);
  const refreshOnConnect = createConnectGate(s.connected, FIRST_CONNECT_GRACE_MS);
  if (!s.connected) {
    s.auth = { token: authToken };
    s.io.opts.reconnection = true;
    s.connect();
  }

  const handleConnect = () => {
    stopPollingFallback();
    if (refreshOnConnect()) onReconnect?.();
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
