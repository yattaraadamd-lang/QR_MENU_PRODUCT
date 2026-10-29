"use client";

import { useState, useCallback } from "react";
import { useVisiblePolling } from "./useVisiblePolling";

export interface BadgeCounts {
  orders: number;
  requests: number;
  payments: number;
  total: number;
}

const EMPTY: BadgeCounts = { orders: 0, requests: 0, payments: 0, total: 0 };

/**
 * useBadgeCounts — Admin ve garson layout'larına nav badge sayaçları sağlar.
 * ✅ PERF: 30 saniyede bir yenilenir (önceki: 8sn). Sekme gizliyken durur, ön plana
 * gelince hemen yenilenir (useVisiblePolling; eskiden sekme gizliyken açılınca da
 * zamanlayıcı kuruluyordu). Socket event'leri ile de `refresh` tetiklenebilir.
 */
export function useBadgeCounts(intervalMs = 30000) {
  const [counts, setCounts] = useState<BadgeCounts>(EMPTY);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/badge-counts");
      if (res.ok) setCounts(await res.json());
    } catch {
      // sessizce geç — badge sayaçları kritik değil
    }
  }, []);

  useVisiblePolling(refresh, intervalMs);

  return { counts, refresh };
}
