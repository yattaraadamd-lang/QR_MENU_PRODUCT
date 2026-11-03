"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "admin_hide_revenue";
const listeners = new Set<() => void>();
/** localStorage kapalıysa (gizli pencere, engelli site verisi) tercih bu oturumda bellekte kalır */
let fallback = false;

function read(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return fallback;
  }
}

function write(hidden: boolean) {
  fallback = hidden;
  try {
    localStorage.setItem(STORAGE_KEY, String(hidden));
  } catch {
    // Yazılamadı: fallback yeterli
  }
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  // Başka sekmede değişirse burada da uygulanır
  window.addEventListener("storage", notify);
  return () => {
    listeners.delete(notify);
    window.removeEventListener("storage", notify);
  };
}

/**
 * "Ciroyu Gizle" tercihi (cihaza özel). useSyncExternalStore: ilk çizimde doğru değer gelir,
 * efektte okunup sonradan gizlenseydi ciro bir kare görünürdü.
 */
export function useRevenueVisibility() {
  const hidden = useSyncExternalStore(subscribe, read, () => false);
  return { revenueHidden: hidden, toggleRevenue: () => write(!hidden) };
}
