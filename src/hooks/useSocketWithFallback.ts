"use client";

import { useEffect, useState, useRef, useCallback } from "react";

/**
 * useConnectionToast — WebSocket bağlantı durumunu izler ve toast gösterir.
 *
 * socket-client.ts'den gelen "socket-connection-status" custom event'lerini dinler.
 * Bağlantı koptuğunda "Bağlantı yenileniyor..." toast'ı gösterir,
 * bağlantı yeniden kurulduğunda "Bağlantı kuruldu" gösterir.
 *
 * @param showToast - Toast gösterme fonksiyonu (opsiyonel, varsa sonner/toast kullanır)
 * @returns { isConnected, isPolling }
 */
export function useConnectionToast(showToast?: (msg: string, type: "ok" | "err") => void) {
  const [isConnected, setIsConnected] = useState(true);
  const [isPolling, setIsPolling] = useState(false);
  const wasDisconnectedRef = useRef(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleStatus = (e: Event) => {
      const detail = (e as CustomEvent).detail;

      if (detail.connected) {
        setIsConnected(true);
        setIsPolling(false);

        // Only show "reconnected" toast if was previously disconnected
        if (wasDisconnectedRef.current) {
          wasDisconnectedRef.current = false;
          if (toastTimerRef.current) {
            clearTimeout(toastTimerRef.current);
            toastTimerRef.current = null;
          }
          showToast?.("✅ Bağlantı kuruldu", "ok");
        }
      } else {
        setIsConnected(false);

        // Debounce: wait 2s before showing disconnect toast
        // (avoids flash on quick reconnects)
        if (!wasDisconnectedRef.current) {
          toastTimerRef.current = setTimeout(() => {
            wasDisconnectedRef.current = true;
            setIsPolling(true);
            showToast?.("🔄 Bağlantı yenileniyor...", "err");
          }, 2000);
        }
      }
    };

    window.addEventListener("socket-connection-status", handleStatus);
    return () => {
      window.removeEventListener("socket-connection-status", handleStatus);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, [showToast]);

  return { isConnected, isPolling };
}

/**
 * useCustomerSessionRevalidation — Müşteri oturumunu sessizce doğrular.
 *
 * Socket bağlantısı koparsa veya belirli aralıklarla
 * /api/customer/session/status endpoint'ini çağırarak token geçerliliğini doğrular.
 *
 * @param sessionToken - Müşteri session token
 * @param onInvalid - Token geçersiz olduğunda çağrılacak callback
 */
export function useCustomerSessionRevalidation(
  sessionToken: string | null,
  onInvalid?: (code: string) => void
) {
  const revalidateRef = useRef(false);

  const revalidate = useCallback(async () => {
    if (!sessionToken || revalidateRef.current) return;
    revalidateRef.current = true;

    try {
      const res = await fetch("/api/customer/session/status", {
        headers: { "x-session-token": sessionToken },
        cache: "no-store",
      });
      const data = await res.json();

      if (!data.valid) {
        onInvalid?.(data.code || "SESSION_INVALID");
      }
    } catch {
      // Network error — don't invalidate, just retry later
    } finally {
      revalidateRef.current = false;
    }
  }, [sessionToken, onInvalid]);

  // Revalidate when socket reconnects after disconnection
  useEffect(() => {
    const handleStatus = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.connected && sessionToken) {
        revalidate();
      }
    };

    window.addEventListener("socket-connection-status", handleStatus);
    return () => window.removeEventListener("socket-connection-status", handleStatus);
  }, [sessionToken, revalidate]);

  return { revalidate };
}
