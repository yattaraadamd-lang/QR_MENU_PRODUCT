"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface BadgeCounts {
  orders: number;
  requests: number;
  payments: number;
  total: number;
}

const EMPTY: BadgeCounts = { orders: 0, requests: 0, payments: 0, total: 0 };

/**
 * useBadgeCounts — Admin ve garson layout'larına nav badge sayaçları sağlar.
 * ✅ PERF: 30 saniyede bir yenilenir (önceki: 8sn).
 * Sekme arka plandayken polling durur, ön plana gelince hemen refresh yapar.
 * Socket event'leri ile de tetiklenebilir.
 */
export function useBadgeCounts(intervalMs = 30000) {
  const [counts, setCounts] = useState<BadgeCounts>(EMPTY);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    // İlk yükleme
    refresh();

    const startPolling = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(refresh, intervalMs);
    };

    const stopPolling = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    // ✅ PERF: Sekme arka plandayken polling durur
    const handleVisibility = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        refresh(); // Ön plana gelince hemen yenile
        startPolling();
      }
    };

    startPolling();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [refresh, intervalMs]);

  return { counts, refresh };
}

