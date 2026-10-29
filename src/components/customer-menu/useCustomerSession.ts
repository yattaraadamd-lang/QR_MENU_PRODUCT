"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useVisiblePolling } from "@/hooks/useVisiblePolling";
import { PENDING_SYNC_MS } from "./constants";
import type { AuthStatus, CanonicalSessionStatus } from "./types";

/**
 * Müşteri cihaz oturumu: masa bazlı localStorage token'ı, canonical yetki durumu
 * (VIEW_ONLY → PENDING → AUTHORIZED / REVOKED) ve garson onayı beklenirken senkron.
 * Sipariş butonu `hydrated` true olana kadar kapalı kalmalı.
 */
export function useCustomerSession(businessId: string) {
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<AuthStatus>("VIEW_ONLY");
  const [verificationCode, setVerificationCode] = useState<string | null>(null);
  const [blockedMsg, setBlockedMsg] = useState<string | null>(null);
  // ✅ Canonical session hydration — UI butonu canonical durum öğrenilmeden aktif olmaz
  const [hydrated, setHydrated] = useState(false);

  // Guard: prevent multiple concurrent canonical sync requests
  const syncInFlightRef = useRef(false);
  // PENDING senkronu yanıt döndüğünde durum değişmişse sonucu yok sayar
  const statusRef = useRef<AuthStatus>("VIEW_ONLY");
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // ✅ Canonical session status helper — tek canonical okuma noktası
  const fetchStatus = useCallback(async (t: string): Promise<CanonicalSessionStatus> => {
    const res = await fetch("/api/customer/session/status", {
      method: "GET",
      headers: { "x-session-token": t },
      cache: "no-store",
    });
    const data = await res.json();
    return {
      ok: res.ok,
      status: data.authorizationStatus as AuthStatus | undefined,
      tableSessionId: data.tableSessionId,
      customerSessionId: data.customerSessionId,
      businessId: data.businessId,
      tableId: data.tableId,
      orderRequestStatus: data.orderRequestStatus,
      code: data.code,
    };
  }, []);

  const ensure = useCallback(async (tableId: string): Promise<string | null> => {
    const storageKey = `qr_session_${businessId}_${tableId}`;

    // localStorage'dan oku (masa bazlı)
    const stored = localStorage.getItem(storageKey);
    // Eski global anahtarı da kontrol et (geriye uyumluluk)
    const oldStored = sessionStorage.getItem("qr_session_token") || localStorage.getItem("qr_session_token");

    const existingToken = stored || oldStored;

    if (existingToken) {
      // ✅ FIX: Token doğrulamayı canonical status endpoint ile yap (URL query değil header)
      try {
        const checkRes = await fetch("/api/customer/session/status", {
          headers: { "x-session-token": existingToken },
          cache: "no-store",
        });
        const checkData = await checkRes.json();
        if (checkData.valid) {
          // Route-table eşleşme kontrolü
          if (checkData.businessId !== businessId || checkData.tableId !== tableId) {
            // Başka masaya ait token — kullanma
            localStorage.removeItem(storageKey);
          } else {
            // Yeni anahtara taşı
            localStorage.setItem(storageKey, existingToken);
            sessionStorage.removeItem("qr_session_token");
            localStorage.removeItem("qr_session_token");

            setToken(existingToken);
            setBlockedMsg(null);
            if (checkData.authorizationStatus) setStatus(checkData.authorizationStatus as AuthStatus);
            setHydrated(true);
            return existingToken;
          }
        } else if (checkData.code === "SESSION_REVOKED") {
          setStatus("REVOKED");
          localStorage.removeItem(storageKey);
          setHydrated(true);
        }
      } catch { /* devam et */ }
    }

    const qrToken = sessionStorage.getItem("qr_token");
    if (!qrToken) {
      setBlockedMsg("Sipariş vermek için masadaki QR kodu okutmanız gerekir.");
      setHydrated(true);
      return null;
    }

    try {
      const sr = await fetch("/api/customer/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, tableId, qrToken, existingToken: existingToken || undefined }),
      });
      const sd = await sr.json();
      if (sr.ok && sd.sessionToken) {
        localStorage.setItem(storageKey, sd.sessionToken);
        sessionStorage.removeItem("qr_session_token");
        sessionStorage.removeItem("qr_order_blocked_msg");
        setToken(sd.sessionToken);
        setBlockedMsg(null);
        if (sd.authorizationStatus) setStatus(sd.authorizationStatus as AuthStatus);
        setHydrated(true);
        return sd.sessionToken;
      }
      setBlockedMsg(sd.message || sd.error || "Sipariş vermek için masadaki QR kodu tekrar okutun.");
      setHydrated(true);
      return null;
    } catch {
      setBlockedMsg("Oturum oluşturulamadı. Lütfen QR kodu tekrar okutun.");
      setHydrated(true);
      return null;
    }
  }, [businessId]);

  // İlk menü yanıtından sonra arka planda çalışır; menüyü bekletmez
  const hydrateInner = useCallback(async (tableId: string) => {
    const blockedHint = sessionStorage.getItem("qr_order_blocked_msg");
    if (blockedHint) setBlockedMsg(blockedHint);

    // ✅ Masa bazlı localStorage'dan token al + canonical status ile hydrate
    const storageKey = `qr_session_${businessId}_${tableId}`;
    const storedToken = localStorage.getItem(storageKey) || sessionStorage.getItem("qr_session_token");
    if (!storedToken) {
      await ensure(tableId);
      return;
    }

    try {
      const canonRes = await fetch("/api/customer/session/status", {
        headers: { "x-session-token": storedToken },
        cache: "no-store",
      });
      const canonData = await canonRes.json();
      if (canonData.valid) {
        // Route-table eşleşme kontrolü
        if (canonData.businessId !== businessId || canonData.tableId !== tableId) {
          // Başka masaya ait token — kullanma
          localStorage.removeItem(storageKey);
          await ensure(tableId);
          return;
        }
        setToken(storedToken);
        setBlockedMsg(null);
        sessionStorage.removeItem("qr_order_blocked_msg");
        localStorage.setItem(storageKey, storedToken);
        sessionStorage.removeItem("qr_session_token");
        if (canonData.authorizationStatus) setStatus(canonData.authorizationStatus as AuthStatus);
        // Pending ORDER_REQUEST varsa verificationCode'u koru
        if (canonData.orderRequestStatus === "PENDING" || canonData.orderRequestStatus === "SEEN") {
          setStatus("PENDING");
        }
        setHydrated(true);
      } else if (canonData.code === "SESSION_REVOKED") {
        setStatus("REVOKED");
        localStorage.removeItem(storageKey);
        setHydrated(true);
      } else {
        // Token geçersiz — yeni oturum oluştur
        localStorage.removeItem(storageKey);
        await ensure(tableId);
      }
    } catch {
      // Network error — tokeni koru, odak/visibility senkronu sonra tekrar dener
      setToken(storedToken);
      setHydrated(true);
    }
  }, [businessId, ensure]);

  // Beklenmeyen hata (ör. depolama erişimi) butonu "kontrol ediliyor"da bırakmasın
  const hydrate = useCallback((tableId: string) => {
    hydrateInner(tableId).catch(() => {
      setBlockedMsg("Oturum doğrulanamadı. Lütfen QR kodu tekrar okutun.");
      setHydrated(true);
    });
  }, [hydrateInner]);

  // ✅ PENDING durumunda canonical polling
  const syncPending = useCallback(async () => {
    if (!token || syncInFlightRef.current) return;
    syncInFlightRef.current = true;
    try {
      const result = await fetchStatus(token);
      if (statusRef.current !== "PENDING") return;
      if (result.status === "AUTHORIZED") {
        setStatus("AUTHORIZED");
        setVerificationCode(null);
        toast.success("Masanız açıldı! Siparişinizi gönderebilirsiniz. ✅");
      } else if (result.status === "REVOKED") {
        setStatus("REVOKED");
      }
    } catch { /* network error — next poll will retry */ }
    finally { syncInFlightRef.current = false; }
  }, [token, fetchStatus]);

  useVisiblePolling(syncPending, PENDING_SYNC_MS, status === "PENDING" && !!token);

  // ✅ window focus / visibilitychange / online — anlık canonical sync
  useEffect(() => {
    if (!token) return;

    const instantSync = () => {
      if (syncInFlightRef.current) return;
      syncInFlightRef.current = true;
      fetchStatus(token)
        .then((result) => {
          if (result.status && result.status !== statusRef.current) {
            setStatus(result.status);
            if (result.status === "AUTHORIZED") setVerificationCode(null);
          }
        })
        .catch(() => {})
        .finally(() => { syncInFlightRef.current = false; });
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
  }, [token, fetchStatus]);

  return {
    token,
    status,
    setStatus,
    verificationCode,
    setVerificationCode,
    blockedMsg,
    hydrated,
    ensure,
    hydrate,
    fetchStatus,
  };
}

export type CustomerSessionApi = ReturnType<typeof useCustomerSession>;
