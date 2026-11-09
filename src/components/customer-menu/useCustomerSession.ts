"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { reportClientError } from "@/lib/report-error";
import { SESSION_MESSAGE } from "./constants";
import { approveDemoOrderRequest, createCustomerSession, getSessionStatus } from "./customer.api";
import { initialSession, sessionReducer, type SessionState } from "./sessionMachine";
import { blockedHint, qrProof, tableTokenStore, takeFreshScan } from "./sessionTokenStore";
import type { AuthStatus } from "./types";
import { useSessionSync } from "./useSessionSync";

/** Kullanıcıya gösterilecek anlar: ekran (toast) kararını bileşen verir */
export interface SessionNotices {
  /** Garson (ya da demoda sistem) masayı açtı */
  readonly onAuthorized?: () => void;
  /** Bekleyen talebin süresi doldu; sepet duruyor */
  readonly onRequestExpired?: () => void;
}

/**
 * Müşteri cihaz oturumu, yani masa güveninin istemci tarafı: canonical yetki durumu
 * (VIEW_ONLY → PENDING → AUTHORIZED / REVOKED) ve garson onayı beklenirken senkron.
 * Geçişler sessionMachine'de, depolar sessionTokenStore'da, istekler customer.api'de.
 * Sipariş butonu `hydrated` true olana kadar kapalı kalmalı.
 */
export function useCustomerSession(businessId: string, notices: SessionNotices = {}) {
  const [state, dispatch] = useReducer(sessionReducer, initialSession);
  // Yanıt döndüğünde güncel durum ve geri çağrılar okunur (PENDING yoklaması)
  const stateRef = useRef<SessionState>(state);
  const noticesRef = useRef(notices);
  useEffect(() => {
    stateRef.current = state;
    noticesRef.current = notices;
  });

  /** QR kanıtıyla oturum açar ya da tazeler; ağ hatası ayrıca döner, çağıran kayıtlı token'la sürer */
  const createFromQr = useCallback(async (
    tableId: string,
    existingToken: string | null,
  ): Promise<{ token: string | null; networkError?: boolean }> => {
    const qrToken = qrProof();
    if (!qrToken) {
      dispatch({ type: "blocked", message: SESSION_MESSAGE.noQrProof });
      return { token: null };
    }
    const result = await createCustomerSession({ businessId, tableId, qrToken, existingToken: existingToken || undefined });
    if (result.kind === "networkError") return { token: null, networkError: true };
    if (result.kind === "rejected") {
      dispatch({ type: "blocked", message: result.message || SESSION_MESSAGE.rescan });
      return { token: null };
    }
    tableTokenStore(businessId, tableId).adopt(result.sessionToken);
    dispatch({ type: "established", token: result.sessionToken, status: result.status });
    return { token: result.sessionToken };
  }, [businessId]);

  const ensure = useCallback(async (tableId: string): Promise<string | null> => {
    const store = tableTokenStore(businessId, tableId);
    const existingToken = store.stored();
    if (existingToken) {
      // Token canonical durum ucuyla doğrulanır (başlıkla); ağ hatasında QR yoluna geçilir
      const check = await getSessionStatus(existingToken);
      if (check.valid && check.businessId === businessId && check.tableId === tableId) {
        store.adopt(existingToken);
        dispatch({ type: "established", token: existingToken, status: check.status });
        return existingToken;
      }
      if (check.valid) {
        store.forget(); // Başka masaya ait token
      } else if (check.code === "SESSION_REVOKED") {
        store.forget();
        dispatch({ type: "revoked" });
      }
    }
    const created = await createFromQr(tableId, existingToken);
    if (created.networkError) dispatch({ type: "blocked", message: SESSION_MESSAGE.createFailed });
    return created.token;
  }, [businessId, createFromQr]);

  // İlk menü yanıtından sonra arka planda çalışır; menüyü bekletmez
  const hydrateInner = useCallback(async (tableId: string) => {
    const hint = blockedHint();
    if (hint) dispatch({ type: "hint", message: hint });
    const store = tableTokenStore(businessId, tableId);

    // QR az önce okutulduysa (qr sayfası oturumu beklemeden yönlendirir) oturum QR kanıtıyla
    // kurulur ya da tazelenir; ağ hatasında aşağıdaki kayıtlı token yoluna düşülür
    if (takeFreshScan(tableId)) {
      const created = await createFromQr(tableId, store.stored());
      if (!created.networkError) return;
    }

    const storedToken = store.stored();
    if (!storedToken) {
      await ensure(tableId);
      return;
    }
    const canon = await getSessionStatus(storedToken);
    if (canon.networkError) {
      // Token korunur; odak/görünürlük senkronu sonra yeniden dener
      dispatch({ type: "offline", token: storedToken });
    } else if (canon.valid && canon.businessId === businessId && canon.tableId === tableId) {
      store.adopt(storedToken);
      dispatch({
        type: "established",
        token: storedToken,
        status: canon.status,
        pendingRequest: canon.orderRequestStatus === "PENDING" || canon.orderRequestStatus === "SEEN",
      });
    } else if (!canon.valid && canon.code === "SESSION_REVOKED") {
      store.forget();
      dispatch({ type: "revoked" });
    } else {
      // Geçersiz ya da başka masaya ait token: yeni oturum
      store.forget();
      await ensure(tableId);
    }
  }, [businessId, ensure, createFromQr]);

  // Beklenmeyen hata (ör. depolama erişimi) butonu "kontrol ediliyor"da bırakmasın
  const hydrate = useCallback((tableId: string) => {
    hydrateInner(tableId).catch((error: unknown) => {
      reportClientError("customer-session.hydrate", error);
      dispatch({ type: "blocked", message: SESSION_MESSAGE.hydrateFailed });
    });
  }, [hydrateInner]);

  useSessionSync(state.token, state.status, {
    // Ağ hatasında durum alanı boş gelir: durum değişmez, sonraki yoklama yeniden dener
    onPendingStatus: async (result, token) => {
      if (stateRef.current.status !== "PENDING") return;
      if (result.status === "AUTHORIZED" || result.status === "REVOKED" || result.status === "VIEW_ONLY") {
        dispatch({ type: "pendingResolved", status: result.status });
        if (result.status === "AUTHORIZED") noticesRef.current.onAuthorized?.();
        if (result.status === "VIEW_ONLY") noticesRef.current.onRequestExpired?.();
      } else if (typeof result.demoAutoApproveInMs === "number") {
        // Demo: garson onaylamazsa sistem onaylar; sonucu bir sonraki yoklama gösterir
        dispatch({ type: "demoCountdown" });
        if (result.demoAutoApproveInMs === 0) await approveDemoOrderRequest(token);
      }
    },
    onFocusStatus: (next) => dispatch({ type: "synced", status: next }),
  });

  const setStatus = useCallback((next: AuthStatus) => dispatch({ type: "status", status: next }), []);
  const setVerificationCode = useCallback((code: string | null) => dispatch({ type: "verificationCode", code }), []);
  return { ...state, setStatus, setVerificationCode, ensure, hydrate, fetchStatus: getSessionStatus };
}

export type CustomerSessionApi = ReturnType<typeof useCustomerSession>;
