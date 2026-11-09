import type { AuthStatus } from "./types";

/**
 * Müşteri oturumunun saf durum geçişleri (FE-ARCH-2.4). useCustomerSession yalnız istek ve
 * depolama yapar, sonucu olay olarak buraya verir; geçişler sessionMachine.test.ts'te sabit.
 */

export interface SessionState {
  readonly token: string | null;
  readonly status: AuthStatus;
  /** Bekleyen sipariş talebinin kodu: garson masaya gelince müşteri söyler */
  readonly verificationCode: string | null;
  /** Siparişin neden engellendiği (QR okutulmadı, oturum açılamadı…) */
  readonly blockedMsg: string | null;
  /** Demo: garson onaylamazsa sistemin onaylayacağı geri sayım başladı */
  readonly demoAutoApprove: boolean;
  /** Canonical durum öğrenildi: sipariş butonu ancak o zaman etkinleşir */
  readonly hydrated: boolean;
}

export type SessionEvent =
  /** Geçerli token benimsendi (yeni oturum, kayıtlı token ya da QR ile tazeleme) */
  | {
      readonly type: "established";
      readonly token: string;
      readonly status?: AuthStatus;
      /** Bekleyen sipariş talebi var: kod ekranda kalsın diye PENDING */
      readonly pendingRequest?: boolean;
    }
  /** Ağ hatası: kayıtlı token korunur, durum sonra senkronlanır */
  | { readonly type: "offline"; readonly token: string }
  /** Sipariş engellendi; neden gösterilir */
  | { readonly type: "blocked"; readonly message: string }
  /** Önceki sayfadan kalan engel metni (durum henüz öğrenilmedi) */
  | { readonly type: "hint"; readonly message: string }
  | { readonly type: "revoked" }
  /** Eylemden ya da sunucudan gelen yetki durumu */
  | { readonly type: "status"; readonly status: AuthStatus }
  | { readonly type: "verificationCode"; readonly code: string | null }
  /** Odak / görünürlük senkronu: durum değiştiyse uygulanır */
  | { readonly type: "synced"; readonly status: AuthStatus }
  /** PENDING yoklamasının sonucu: yalnız hâlâ PENDING iken uygulanır */
  | { readonly type: "pendingResolved"; readonly status: "AUTHORIZED" | "REVOKED" | "VIEW_ONLY" }
  | { readonly type: "demoCountdown" };

export const initialSession: SessionState = {
  token: null,
  status: "VIEW_ONLY",
  verificationCode: null,
  blockedMsg: null,
  demoAutoApprove: false,
  hydrated: false,
};

export function sessionReducer(state: SessionState, event: SessionEvent): SessionState {
  switch (event.type) {
    case "established":
      return {
        ...state,
        token: event.token,
        blockedMsg: null,
        status: event.pendingRequest ? "PENDING" : (event.status ?? state.status),
        hydrated: true,
      };
    case "offline":
      return { ...state, token: event.token, hydrated: true };
    case "blocked":
      return { ...state, blockedMsg: event.message, hydrated: true };
    case "hint":
      return { ...state, blockedMsg: event.message };
    case "revoked":
      return { ...state, status: "REVOKED", hydrated: true };
    case "status":
      return state.status === event.status ? state : { ...state, status: event.status };
    case "verificationCode":
      return { ...state, verificationCode: event.code };
    case "synced":
      if (event.status === state.status) return state;
      return {
        ...state,
        status: event.status,
        verificationCode: event.status === "AUTHORIZED" ? null : state.verificationCode,
      };
    case "pendingResolved":
      if (state.status !== "PENDING") return state;
      if (event.status === "AUTHORIZED") return { ...state, status: "AUTHORIZED", verificationCode: null };
      if (event.status === "REVOKED") return { ...state, status: "REVOKED" };
      return { ...state, status: "VIEW_ONLY", verificationCode: null, demoAutoApprove: false };
    case "demoCountdown":
      return state.demoAutoApprove ? state : { ...state, demoAutoApprove: true };
  }
}
