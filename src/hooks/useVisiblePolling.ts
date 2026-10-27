"use client";

import { useEffect, useRef } from "react";

/**
 * Sekme görünürken `callback`'i her `intervalMs`'de bir çağırır.
 * ✅ PERF: Sekme arka plandayken polling durur, ön plana gelince hemen bir kez çağırıp devam eder
 * (useBadgeCounts ile aynı davranış). `enabled` false iken hiç çalışmaz.
 *
 * Callback her render'da değişse de aralık yeniden kurulmaz; her tick en güncel callback'i çağırır.
 * `runImmediately`: başlarken (ve aralık/enabled değişince) bir kez hemen çağır.
 */
export function useVisiblePolling(
  callback: () => void | Promise<void>,
  intervalMs: number,
  enabled = true,
  runImmediately = true
) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setInterval> | null = null;
    const tick = () => {
      void savedCallback.current();
    };
    const start = () => {
      if (timer === null) timer = setInterval(tick, intervalMs);
    };
    const stop = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };

    const handleVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        tick(); // Ön plana gelince hemen yenile
        start();
      }
    };

    if (!document.hidden) {
      if (runImmediately) tick();
      start();
    }
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [enabled, intervalMs, runImmediately]);
}
