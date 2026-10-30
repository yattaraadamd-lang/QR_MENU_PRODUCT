"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { subscribeToBusinessRoom } from "@/lib/socket-client";

const STAFF_ROLES = new Set(["WAITER", "ADMIN", "SUPER_ADMIN"]);

/**
 * Personel bildirimleri için işletme odası aboneliği: her olayda onEvent(olay, veri).
 * Abonelik oturumun kararlı değerlerine bağlı (sekme odağında yenilenen oturum nesnesine
 * değil); onEvent her çizimde değişse de yeniden abone olunmaz, her olay en günceli çağırır.
 * Başka işletmeye ait olduğu belirtilen veri yanlışlıkla gelirse yoksayılır.
 */
export function useStaffSocket(
  events: readonly string[],
  onEvent: (event: string, data: Record<string, unknown>) => void,
) {
  const { data: session } = useSession();
  const businessId = session?.user.businessId;
  const role = session?.user.role;
  const accessToken = session?.accessToken;

  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  });

  const eventsKey = events.join(",");
  useEffect(() => {
    if (!businessId || !role || !STAFF_ROLES.has(role) || !accessToken) return;
    const handlers = Object.fromEntries(
      eventsKey.split(",").map((event) => [
        event,
        (data: Record<string, unknown> | null) => {
          const payload = data ?? {};
          if (payload._businessId && payload._businessId !== businessId) return;
          onEventRef.current(event, payload);
        },
      ]),
    );
    // Sunucu yeniden bağlanınca odaya kendiliğinden katılır; çıkışta yalnız bu dinleyiciler kalkar
    return subscribeToBusinessRoom(accessToken, handlers);
  }, [businessId, role, accessToken, eventsKey]);
}
