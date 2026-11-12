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

/** Kimlik hatası yüzünden yeniden bağlanma kapandı (`detail.code`: sunucunun kodu) */
export const SOCKET_AUTH_FAILED_EVENT = "socket-auth-failed";
/** Bağlantı kuruldu ya da koptu (`detail.connected`) */
export const SOCKET_STATUS_EVENT = "socket-connection-status";

/** Bağlantı yokken aboneliğin geri çağrısı bu aralıkla çalışır */
const POLLING_FALLBACK_MS = 5000;
/** Şu an yoklayan aboneliklerin durdurucuları: oturum kapanınca hepsi durur */
const activePolls = new Set<() => void>();

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
 * Bağlantı yokken bir aboneliğin yedek yoklaması (FE-ARCH-3.9b). Her abonelik kendi geri
 * çağrısını kendi aralığıyla çağırır; önceden tek küresel geri çağrı tutulduğu için iki abonelik
 * varken yalnız sonuncusu yoklanıyordu. `start` geri çağrıyı hemen bir kez çalıştırır, zaten
 * yokluyorsa bir şey yapmaz.
 */
export function createPollingFallback(callback: () => void, intervalMs = POLLING_FALLBACK_MS) {
  let timer: ReturnType<typeof setInterval> | null = null;
  const stop = () => {
    if (timer === null) return;
    clearInterval(timer);
    timer = null;
    activePolls.delete(stop);
  };
  const start = () => {
    if (timer !== null) return;
    timer = setInterval(callback, intervalMs);
    activePolls.add(stop);
    callback();
  };
  return { start, stop };
}

/** Yoklayan bütün abonelikleri durdurur (oturum kapanışı) */
export function stopAllPolling(): void {
  for (const stop of [...activePolls]) stop();
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
        window.dispatchEvent(new CustomEvent(SOCKET_AUTH_FAILED_EVENT, { detail: { code } }));
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
          window.dispatchEvent(new CustomEvent(SOCKET_AUTH_FAILED_EVENT, { detail: { code: "TOKEN_REFRESH_FAILED" } }));
        } finally {
          tokenRefreshInProgress = false;
        }
        return;
      }
    });

    // ✅ Connection status events for UI
    socket.on("disconnect", (reason) => {
      console.warn("[Socket] Disconnected:", reason);
      window.dispatchEvent(new CustomEvent(SOCKET_STATUS_EVENT, { detail: { connected: false, reason } }));
    });

    // Yedek yoklamayı her abonelik kendi "connect" dinleyicisinde durdurur
    socket.on("connect", () => {
      console.log("[Socket] Connected");
      window.dispatchEvent(new CustomEvent(SOCKET_STATUS_EVENT, { detail: { connected: true } }));
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
 * bağlanınca ve bağlantı yokken (aboneliğin kendi yedek yoklaması) çağrılır; sayfa açılırken kurulan ilk
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

  const polling = onReconnect ? createPollingFallback(onReconnect) : null;
  const handleConnect = () => {
    polling?.stop();
    if (refreshOnConnect()) onReconnect?.();
  };
  const handleDisconnect = () => polling?.start();

  s.on("connect", handleConnect);
  s.on("disconnect", handleDisconnect);
  Object.entries(handlers).forEach(([ev, fn]) => s.on(ev, fn));

  return () => {
    s.off("connect", handleConnect);
    s.off("disconnect", handleDisconnect);
    Object.entries(handlers).forEach(([ev, fn]) => s.off(ev, fn));
    // Bu aboneliğin yedek yoklaması ayrılmış ekran için çalışmaya devam etmesin
    polling?.stop();
  };
}

/**
 * Socket bağlantısını kapat ve instance'ı sıfırla.
 * Kullanıcı logout olunca çağrılmalı.
 */
export function disconnectSocket(): void {
  stopAllPolling();
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  tokenRefreshInProgress = false;
}
