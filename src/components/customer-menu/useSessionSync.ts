"use client";

import { useCallback, useEffect, useRef } from "react";
import { useVisiblePolling } from "@/hooks/useVisiblePolling";
import { PENDING_SYNC_MS } from "./constants";
import { getSessionStatus, type SessionStatus } from "./customer.api";
import type { AuthStatus } from "./types";

interface SyncHandlers {
  /** Garson onayı beklerken (PENDING) gelen canonical durum */
  readonly onPendingStatus: (result: SessionStatus, token: string) => Promise<void> | void;
  /** Sekme öne gelince ya da bağlantı dönünce okunan durum */
  readonly onFocusStatus: (status: AuthStatus) => void;
}

/**
 * Canonical oturum durumunun ne zaman okunacağı: PENDING iken düzenli yoklama, odak,
 * görünürlük ve bağlantı dönüşünde anlık okuma. Aynı anda tek istek; getSessionStatus
 * reddetmez, ağ hatasında durum alanı boş gelir.
 */
export function useSessionSync(token: string | null, status: AuthStatus, handlers: SyncHandlers) {
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });
  const inFlightRef = useRef(false);

  const pollPending = useCallback(async () => {
    if (!token || inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      await handlersRef.current.onPendingStatus(await getSessionStatus(token), token);
    } finally {
      inFlightRef.current = false;
    }
  }, [token]);

  useVisiblePolling(pollPending, PENDING_SYNC_MS, status === "PENDING" && !!token);

  useEffect(() => {
    if (!token) return;
    const instantSync = () => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      void getSessionStatus(token)
        .then((result) => {
          if (result.status) handlersRef.current.onFocusStatus(result.status);
        })
        .finally(() => {
          inFlightRef.current = false;
        });
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") instantSync();
    };
    window.addEventListener("focus", instantSync);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("online", instantSync);
    return () => {
      window.removeEventListener("focus", instantSync);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("online", instantSync);
    };
  }, [token]);
}
