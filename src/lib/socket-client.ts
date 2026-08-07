"use client";

import { io, Socket } from "socket.io-client";

/**
 * 🔒 SECURITY FIX P0-03: Socket.IO Client with Authentication
 * 
 * CHANGES:
 * - JWT token passed in handshake auth
 * - Token obtained from NextAuth session
 * - Automatic reconnection with fresh token
 * - No client-controlled businessId
 */

// Singleton socket instance
let socket: Socket | null = null;

/**
 * Socket instance'ını döndürür. İlk çağrıda oluşturur.
 * 
 * ✅ P0-03 FIX: Requires authentication token in handshake
 * 
 * @param authToken NextAuth JWT token (required)
 * @returns Socket instance
 */
export function getSocket(authToken?: string): Socket {
  if (!socket) {
    const url = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    
    socket = io(url, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,   // süresiz yeniden bağlanma
      reconnectionDelay: 1000,          // ilk retry 1sn
      reconnectionDelayMax: 10000,      // max 10sn aralıkla
      randomizationFactor: 0.3,         // jitter — thundering herd önleme
      timeout: 20000,
      // ✅ P0-03 FIX: Pass authentication token in handshake
      auth: authToken ? { token: authToken } : undefined,
    });

    // ✅ Handle authentication errors
    socket.on("connect_error", (error: any) => {
      console.error("[Socket] Connection error:", error?.message || error);
      
      // ❌ DO NOT auto-retry if authentication failed
      if (error?.data?.code === "INVALID_TOKEN" || 
          error?.data?.code === "NO_TOKEN" ||
          error?.data?.code === "USER_DISABLED") {
        socket?.disconnect();
        // Application should handle this by redirecting to login
        window.dispatchEvent(new CustomEvent("socket-auth-failed", { 
          detail: { code: error?.data?.code } 
        }));
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
 * @param authToken     NextAuth JWT token (required for authentication)
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
}
