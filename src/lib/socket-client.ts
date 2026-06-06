"use client";

import { io, Socket } from "socket.io-client";

// Singleton socket instance
let socket: Socket | null = null;

/**
 * Socket instance'ını döndürür. İlk çağrıda oluşturur.
 * autoConnect: false — bağlantıyı manuel kontrol etmek için.
 */
export function getSocket(): Socket {
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
    });
  }
  return socket;
}

/**
 * İşletme odasına bağlan.
 * Bağlantı kesilip tekrar kurulduğunda (reconnect) `onReconnect` callback'i çağrılır.
 * Garson sayfaları bu callback'i API'den veri yenileme için kullanır.
 *
 * @param businessId    Bağlanılacak işletme ID'si
 * @param onReconnect   Bağlantı yeniden kurulunca çağrılacak fonksiyon (opsiyonel)
 * @returns socket instance
 */
export function connectToBusinessRoom(
  businessId: string,
  onReconnect?: () => void
): Socket {
  const s = getSocket();

  if (!s.connected) {
    s.connect();
  }

  // İşletme odasına katıl
  s.emit("join_business", businessId);

  // Reconnect sonrası otomatik olarak tekrar odaya katıl ve veri senkronize et
  const handleReconnect = () => {
    s.emit("join_business", businessId);
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
