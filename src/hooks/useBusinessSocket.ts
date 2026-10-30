"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { subscribeToBusinessRoom } from "@/lib/socket-client";

/**
 * Personel ekranları için işletme odası aboneliği: `events` olaylarında, yeniden
 * bağlanınca ve bağlantı koptuğunda (yedek polling) `onEvent` çağrılır. Ekran
 * ayrılınca yalnız kendi dinleyicileri kaldırılır.
 */
export function useBusinessSocket(events: readonly string[], onEvent: () => void) {
  const { data: session } = useSession();
  const accessToken = session?.accessToken;

  // Geri çağrı her çizimde değişse de abonelik yenilenmez; her olay en günceli çağırır
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  });

  // Dizi her çizimde yeni olabilir; abonelik olay listesinin içeriğine bağlı
  const eventsKey = events.join(",");
  useEffect(() => {
    if (!accessToken) return;
    const handler = () => onEventRef.current();
    const handlers = Object.fromEntries(eventsKey.split(",").map((ev) => [ev, handler]));
    return subscribeToBusinessRoom(accessToken, handlers, handler);
  }, [accessToken, eventsKey]);
}
