"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useVisiblePolling } from "@/hooks/useVisiblePolling";
import { PENDING_SYNC_MS } from "./constants";
import { approveDemoOrderRequest, createCustomerSession, getSessionStatus } from "./customer.api";
import type { AuthStatus } from "./types";

/**
 * Müşteri cihaz oturumu: masa bazlı localStorage token'ı, canonical yetki durumu
 * (VIEW_ONLY → PENDING → AUTHORIZED / REVOKED) ve garson onayı beklenirken senkron.
 * Sipariş butonu `hydrated` true olana kadar kapalı kalmalı. İstekler customer.api.ts'te;
 * ağ hatası istisna değil `networkError` olarak döner.
 */
export function useCustomerSession(businessId: string) {
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<AuthStatus>("VIEW_ONLY");
  const [verificationCode, setVerificationCode] = useState<string | null>(null);
  const [blockedMsg, setBlockedMsg] = useState<string | null>(null);
  const [demoAutoApprove, setDemoAutoApprove] = useState(false);
  // ✅ Canonical session hydration — UI butonu canonical durum öğrenilmeden aktif olmaz
  const [hydrated, setHydrated] = useState(false);

  // Guard: prevent multiple concurrent canonical sync requests
  const syncInFlightRef = useRef(false);
  // PENDING senkronu yanıt döndüğünde durum değişmişse sonucu yok sayar
  const statusRef = useRef<AuthStatus>("VIEW_ONLY");
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  /**
   * QR tarama kanıtıyla (sessionStorage qr_token) oturum oluşturur ya da tazeler. Ağ hatası
   * ayrıca bildirilir: taze okutmada çağıran kayıtlı token'la devam edebilsin.
   */
  const createFromQr = useCallback(async (
    tableId: string,
    existingToken: string | null,
  ): Promise<{ token: string | null; networkError?: boolean }> => {
    const storageKey = `qr_session_${businessId}_${tableId}`;
    const qrToken = sessionStorage.getItem("qr_token");
    if (!qrToken) {
      setBlockedMsg("Sipariş vermek için masadaki QR kodu okutmanız gerekir.");
      setHydrated(true);
      return { token: null };
    }

    const result = await createCustomerSession({ businessId, tableId, qrToken, existingToken: existingToken || undefined });
    if (result.kind === "networkError") return { token: null, networkError: true };
    if (result.kind === "rejected") {
      setBlockedMsg(result.message || "Sipariş vermek için masadaki QR kodu tekrar okutun.");
      setHydrated(true);
      return { token: null };
    }

    localStorage.setItem(storageKey, result.sessionToken);
    // Eski global anahtarları temizle
    localStorage.removeItem("qr_session_token");
    sessionStorage.removeItem("qr_session_token");
    sessionStorage.removeItem("qr_order_blocked_msg");
    setToken(result.sessionToken);
    setBlockedMsg(null);
    if (result.status) setStatus(result.status);
    setHydrated(true);
    return { token: result.sessionToken };
  }, [businessId]);

  const ensure = useCallback(async (tableId: string): Promise<string | null> => {
    const storageKey = `qr_session_${businessId}_${tableId}`;

    // localStorage'dan oku (masa bazlı)
    const stored = localStorage.getItem(storageKey);
    // Eski global anahtarı da kontrol et (geriye uyumluluk)
    const oldStored = sessionStorage.getItem("qr_session_token") || localStorage.getItem("qr_session_token");

    const existingToken = stored || oldStored;

    if (existingToken) {
      // Token canonical durum ucuyla doğrulanır (URL sorgusu değil başlık); ağ hatasında QR yoluna geçilir
      const check = await getSessionStatus(existingToken);
      if (check.valid) {
        // Route-table eşleşme kontrolü
        if (check.businessId !== businessId || check.tableId !== tableId) {
          // Başka masaya ait token — kullanma
          localStorage.removeItem(storageKey);
        } else {
          // Yeni anahtara taşı
          localStorage.setItem(storageKey, existingToken);
          sessionStorage.removeItem("qr_session_token");
          localStorage.removeItem("qr_session_token");

          setToken(existingToken);
          setBlockedMsg(null);
          if (check.status) setStatus(check.status);
          setHydrated(true);
          return existingToken;
        }
      } else if (check.code === "SESSION_REVOKED") {
        setStatus("REVOKED");
        localStorage.removeItem(storageKey);
        setHydrated(true);
      }
    }

    const r = await createFromQr(tableId, existingToken);
    if (r.networkError) {
      setBlockedMsg("Oturum oluşturulamadı. Lütfen QR kodu tekrar okutun.");
      setHydrated(true);
    }
    return r.token;
  }, [businessId, createFromQr]);

  // İlk menü yanıtından sonra arka planda çalışır; menüyü bekletmez
  const hydrateInner = useCallback(async (tableId: string) => {
    const blockedHint = sessionStorage.getItem("qr_order_blocked_msg");
    if (blockedHint) setBlockedMsg(blockedHint);

    const storageKey = `qr_session_${businessId}_${tableId}`;

    // QR az önce okutulduysa (qr sayfası işaret bırakır, oturumu beklemeden yönlendirir)
    // oturum QR kanıtıyla kurulur/tazelenir; eskiden bu istek menüyü bir gidiş-dönüş geciktiriyordu.
    // Ağ hatasında aşağıdaki kayıtlı token yoluna düşülür (eski QR sayfası da öyle devam ediyordu).
    if (sessionStorage.getItem("qr_fresh_scan") === tableId) {
      sessionStorage.removeItem("qr_fresh_scan");
      const r = await createFromQr(tableId, localStorage.getItem(storageKey));
      if (!r.networkError) return;
    }

    // ✅ Masa bazlı localStorage'dan token al + canonical status ile hydrate
    const storedToken = localStorage.getItem(storageKey) || sessionStorage.getItem("qr_session_token");
    if (!storedToken) {
      await ensure(tableId);
      return;
    }

    const canon = await getSessionStatus(storedToken);
    if (canon.networkError) {
      // Ağ hatası — token korunur, odak/görünürlük senkronu sonra tekrar dener
      setToken(storedToken);
      setHydrated(true);
    } else if (canon.valid) {
      // Route-table eşleşme kontrolü
      if (canon.businessId !== businessId || canon.tableId !== tableId) {
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
      if (canon.status) setStatus(canon.status);
      // Pending ORDER_REQUEST varsa verificationCode'u koru
      if (canon.orderRequestStatus === "PENDING" || canon.orderRequestStatus === "SEEN") {
        setStatus("PENDING");
      }
      setHydrated(true);
    } else if (canon.code === "SESSION_REVOKED") {
      setStatus("REVOKED");
      localStorage.removeItem(storageKey);
      setHydrated(true);
    } else {
      // Token geçersiz — yeni oturum oluştur
      localStorage.removeItem(storageKey);
      await ensure(tableId);
    }
  }, [businessId, ensure, createFromQr]);

  // Beklenmeyen hata (ör. depolama erişimi) butonu "kontrol ediliyor"da bırakmasın
  const hydrate = useCallback((tableId: string) => {
    hydrateInner(tableId).catch(() => {
      setBlockedMsg("Oturum doğrulanamadı. Lütfen QR kodu tekrar okutun.");
      setHydrated(true);
    });
  }, [hydrateInner]);

  // ✅ PENDING durumunda canonical polling; ağ hatasında durum değişmez, sonraki yoklama yeniden dener
  const syncPending = useCallback(async () => {
    if (!token || syncInFlightRef.current) return;
    syncInFlightRef.current = true;
    try {
      const result = await getSessionStatus(token);
      if (statusRef.current !== "PENDING") return;
      if (result.status === "AUTHORIZED") {
        setStatus("AUTHORIZED");
        setVerificationCode(null);
        toast.success("Masanız açıldı! Siparişinizi gönderebilirsiniz. ✅");
      } else if (result.status === "REVOKED") {
        setStatus("REVOKED");
      } else if (result.status === "VIEW_ONLY") {
        // Talebin süresi doldu: müşteri yeniden gönderebilir (sepet duruyor)
        setStatus("VIEW_ONLY");
        setVerificationCode(null);
        setDemoAutoApprove(false);
        toast.info("Talebinizin süresi doldu. Siparişinizi yeniden gönderebilirsiniz.");
      } else if (typeof result.demoAutoApproveInMs === "number") {
        // Demo: garson onaylamazsa sistem onaylar; sonucu bir sonraki yoklama gösterir
        setDemoAutoApprove(true);
        if (result.demoAutoApproveInMs === 0) await approveDemoOrderRequest(token);
      }
    } finally {
      syncInFlightRef.current = false;
    }
  }, [token]);

  useVisiblePolling(syncPending, PENDING_SYNC_MS, status === "PENDING" && !!token);

  // ✅ window focus / visibilitychange / online — anlık canonical sync
  useEffect(() => {
    if (!token) return;

    // getSessionStatus reddetmez: ağ hatasında `status` boş döner, durum değişmez
    const instantSync = () => {
      if (syncInFlightRef.current) return;
      syncInFlightRef.current = true;
      void getSessionStatus(token)
        .then((result) => {
          if (result.status && result.status !== statusRef.current) {
            setStatus(result.status);
            if (result.status === "AUTHORIZED") setVerificationCode(null);
          }
        })
        .finally(() => {
          syncInFlightRef.current = false;
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

  return {
    token,
    status,
    setStatus,
    verificationCode,
    setVerificationCode,
    demoAutoApprove,
    blockedMsg,
    hydrated,
    ensure,
    hydrate,
    fetchStatus: getSessionStatus,
  };
}

export type CustomerSessionApi = ReturnType<typeof useCustomerSession>;
