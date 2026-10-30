"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { NotificationItem } from "./types";

// ─── Auto-expiry (30 minutes) ─────────────────────────────────────────────────
const AUTO_EXPIRY_MS = 30 * 60 * 1000;
const MAX_ITEMS = 30;
const TOAST_MS = 5000;

type TimerRef = { current: ReturnType<typeof setTimeout> | null };
function clearTimer(ref: TimerRef) {
  if (ref.current) {
    clearTimeout(ref.current);
    ref.current = null;
  }
}

/**
 * Bildirim listesi, okunmamış sayısı ve ekrandaki toast. Kritik (persistent) toast elle
 * kapatılana kadar kalır, diğerleri 5 sn sonra kapanır. Eylemler kararlıdır.
 */
export function useNotificationStore() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toast, setToast] = useState<NotificationItem | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Listeye ekler, okunmamışı artırır ve toast olarak gösterir */
  const push = useCallback((item: NotificationItem) => {
    setNotifications((prev) => [item, ...prev].slice(0, MAX_ITEMS));
    setUnreadCount((prev) => prev + 1);

    clearTimer(toastTimerRef);
    setToast(item);
    // Kritik bildirimler → kalıcı toast (elle kapatılana kadar)
    if (item.persistent) return;
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, TOAST_MS);
  }, []);

  const dismissToast = useCallback(() => {
    clearTimer(toastTimerRef);
    setToast(null);
  }, []);

  const clearNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  const markAllRead = useCallback(() => setUnreadCount(0), []);

  // ✅ Auto-expiry: 30 dakikadan eski bildirimler listeden düşer
  useEffect(() => {
    const timer = setInterval(() => {
      const cutoff = Date.now() - AUTO_EXPIRY_MS;
      setNotifications((prev) => {
        const next = prev.filter((n) => n.createdAt.getTime() > cutoff);
        return next.length === prev.length ? prev : next;
      });
    }, 60000);
    const toastTimer = toastTimerRef;
    return () => {
      clearInterval(timer);
      clearTimer(toastTimer);
    };
  }, []);

  return { notifications, unreadCount, toast, push, dismissToast, clearNotification, clearAll, markAllRead };
}
