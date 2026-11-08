"use client";

import { useState, useCallback } from "react";
import { apiRequest } from "@/lib/api-client";
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

  // Sayaçlar kritik değil: istek başarısızsa son değerler kalır, sonraki yoklama yeniler
  const refresh = useCallback(async () => {
    const result = await apiRequest<BadgeCounts>("/api/badge-counts");
    if (result.ok) setCounts(result.data);
  }, []);

  useVisiblePolling(refresh, intervalMs);

  return { counts, refresh };
}
