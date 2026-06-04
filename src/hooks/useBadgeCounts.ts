"use client";

import { useState, useEffect, useCallback } from "react";

export interface BadgeCounts {
  orders: number;
  requests: number;
  payments: number;
  total: number;
}

const EMPTY: BadgeCounts = { orders: 0, requests: 0, payments: 0, total: 0 };

/**
 * useBadgeCounts — Admin ve garson layout'larına nav badge sayaçları sağlar.
 * Her 8 saniyede bir otomatik yenilenir. Socket event'leri ile de tetiklenebilir.
 */
export function useBadgeCounts(intervalMs = 8000) {
  const [counts, setCounts] = useState<BadgeCounts>(EMPTY);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/badge-counts");
      if (res.ok) {
        const data = await res.json();
        setCounts(data);
      }
    } catch {
      // sessizce geç — badge sayaçları kritik değil
    }
  }, []);

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, intervalMs);
    return () => clearInterval(iv);
  }, [refresh, intervalMs]);

  return { counts, refresh };
}
