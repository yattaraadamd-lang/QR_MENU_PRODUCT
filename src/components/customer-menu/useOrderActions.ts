"use client";

import { useState } from "react";
import { reportClientError } from "@/lib/report-error";
import {
  errorCode,
  requestCodeOf,
  sendOrder,
  sendOrderRequest,
  sendPaymentRequest,
  sendServiceRequest,
  type CartLine,
} from "./customer.api";
import type { CartApi } from "./useCart";
import type { CustomerSessionApi } from "./useCustomerSession";
import type { ActiveRequests, AuthStatus, Business, TableInfo } from "./types";

/** Eylem sonucunu kullanıcıya gösterme: toast mı pencere içi mi kararını bileşen verir */
export interface ActionNotifier {
  readonly success: (message: string) => void;
  readonly error: (message: string) => void;
  /** Yeni eylem başlarken önceki hata temizlenir */
  readonly clear: () => void;
}

type Params = {
  notify: ActionNotifier;
  /** Rota parametresi: oturumun bu masaya ait olduğu buna göre doğrulanır */
  routeBusinessId: string;
  business: Business | null;
  table: TableInfo | null;
  session: CustomerSessionApi;
  cart: CartApi;
  orderNote: string;
  activeRequests: ActiveRequests;
  /** Sipariş başarıyla gitti: not ve mobil sepet kapatılır */
  onOrderSent: () => void;
  /** Hizmet talebi gitti: açık pencereler kapatılır */
  onRequestSent: () => void;
  refreshMenu: () => void;
  refreshRequests: () => void;
};

const BLOCKED_DEVICE = "Bu cihazın bu işletmede işlem yapması engellendi.";
const UNEXPECTED_ERROR = "İşlem tamamlanamadı. Lütfen tekrar deneyin.";
const TABLE_CLAIMED = "Bu masa başka bir aktif oturuma ait. Personelden yardım isteyin.";

const cartLines = (cart: CartApi): CartLine[] =>
  cart.items.map((i) => ({ productId: i.product.id, quantity: i.quantity, customerNote: i.customerNote || null }));

/**
 * Aynı siparişin iki kez yazılmasını önleyen anahtar (sunucu: [A-Za-z0-9_-], 8–128). uuid paketi
 * yerine tarayıcı API'si; crypto.randomUUID güvenli olmayan bağlamda (yerel ağda http) yok.
 */
const idempotencyKey = (prefix: string): string => {
  const random =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${random}`;
};

/** Yetki durumuna göre sipariş (VIEW_ONLY → ORDER_REQUEST, AUTHORIZED → sipariş) ve hizmet talepleri */
export function useOrderActions(p: Params) {
  const { session, cart, notify } = p;
  const [submitting, setSubmitting] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(false);

  // ✅ Tek gerçek sipariş gönderme fonksiyonu — yalnız AUTHORIZED durumda çağrılır
  const sendActualOrder = async (token: string): Promise<boolean> => {
    const result = await sendOrder(token, {
      items: cartLines(cart),
      note: p.orderNote || null,
      idempotencyKey: idempotencyKey("ord"),
    });
    if (result.ok) {
      cart.clear();
      p.onOrderSent();
      notify.success("Siparişiniz gönderildi! Garson onayı bekleniyor... ⏳");
      return true;
    }
    const code = errorCode(result);
    if (code === "CUSTOMER_DEVICE_BLOCKED") {
      notify.error(BLOCKED_DEVICE);
    } else if (code === "SESSION_NOT_AUTHORIZED_FOR_TABLE" || code === "SESSION_REVOKED") {
      session.setStatus("REVOKED");
      notify.error("Oturumunuz sonlanmış. Personelden yardım isteyin.");
    } else {
      notify.error(result.error);
      // Ürün stokta yok / kaldırılmış olabilir: menüyü 60 sn beklemeden yenile;
      // menü yenilenince sepetteki stoksuz ürünler temizlenir
      if (result.status === 400 || result.status === 404) p.refreshMenu();
    }
    return false;
  };

  // ✅ Yetkiye göre ana sipariş aksiyonu
  const submitOrder = async () => {
    const { business, table } = p;
    if (!cart.items.length || !business || !table) return;
    if (submitting) return;
    notify.clear();

    // REVOKED veya TABLE_ALREADY_CLAIMED durumunda engelle
    if (session.status === "REVOKED" || session.status === "TABLE_ALREADY_CLAIMED") {
      notify.error(TABLE_CLAIMED);
      return;
    }

    setSubmitting(true);
    try {
      const token = session.token || (await session.ensure(table.id));
      if (!token) {
        notify.error(session.blockedMsg || "Sipariş vermek için masadaki QR kodu okutun.");
        return;
      }

      // ✅ Canonical status'u önce kontrol et — local state stale olabilir.
      // Ağ hatasında (networkError) aşağıdaki dallara girilmez, local state ile devam edilir.
      let effective: AuthStatus = session.status;
      const server = await session.fetchStatus(token);
      if (server.ok && server.status) {
        // Route-table eşleşme kontrolü
        if (server.businessId !== p.routeBusinessId || server.tableId !== table.id) {
          notify.error("Oturum farklı masaya ait. Lütfen QR kodu tekrar okutun.");
          return;
        }
        effective = server.status;
        if (effective !== session.status) session.setStatus(effective);

        if (effective === "REVOKED") {
          notify.error("Oturumunuz iptal edilmiş. Personelden yardım isteyin.");
          return;
        }
        if (effective === "TABLE_ALREADY_CLAIMED") {
          notify.error(TABLE_CLAIMED);
          return;
        }
      } else if (server.code === "SESSION_REVOKED") {
        session.setStatus("REVOKED");
        notify.error("Oturumunuz iptal edilmiş. Personelden yardım isteyin.");
        return;
      } else if (server.code === "SESSION_EXPIRED" || server.code === "SESSION_NOT_FOUND") {
        notify.error("Oturum süresi dolmuş. QR kodu tekrar okutun.");
        return;
      }

      // ── AUTHORIZED: Aynı tıklamada gerçek siparişi gönder
      if (effective === "AUTHORIZED") {
        await sendActualOrder(token);
        return;
      }

      // ── PENDING: Zaten bekliyor, ikinci ORDER_REQUEST oluşturma
      if (effective === "PENDING") {
        notify.error("Garson onayı bekleniyor. Lütfen bekleyin.");
        return;
      }

      // ── VIEW_ONLY: ORDER_REQUEST oluştur (sepet verileri ile)
      if (effective === "VIEW_ONLY") {
        const result = await sendOrderRequest(token, {
          businessId: business.id,
          tableId: table.id,
          reason: "Sipariş vermek istiyorum",
          items: cartLines(cart),
          orderNote: p.orderNote || null,
          idempotencyKey: idempotencyKey("or"),
        });
        const code = errorCode(result);
        const verificationCode = requestCodeOf(result);
        if (result.ok) {
          session.setStatus("PENDING");
          if (verificationCode) session.setVerificationCode(verificationCode);
          // ✅ Sepet korunur — ORDER_REQUEST ile temizleme
          notify.success("Sipariş talebiniz oluşturuldu. Garson onayı bekleniyor.");
        } else if (code === "CUSTOMER_DEVICE_BLOCKED") {
          notify.error(BLOCKED_DEVICE);
        } else if (code === "TABLE_ALREADY_CLAIMED") {
          session.setStatus("TABLE_ALREADY_CLAIMED");
          notify.error(TABLE_CLAIMED);
        } else if (code === "ORDER_REQUEST_PENDING") {
          session.setStatus("PENDING");
          if (verificationCode) session.setVerificationCode(verificationCode);
          notify.error("Bekleyen talebiniz var. Garson onayı bekleniyor.");
        } else if (code === "SESSION_ALREADY_AUTHORIZED") {
          // ✅ Canonical doğrula + aynı tıklamada sipariş gönder (ağ hatasında butona bırakır)
          const recheck = await session.fetchStatus(token);
          session.setStatus("AUTHORIZED");
          if (recheck.ok && recheck.status === "AUTHORIZED") await sendActualOrder(token);
          else notify.success("Masanız açık! Siparişi Gönder butonuna basın.");
        } else {
          notify.error(result.error);
        }
      }
    } catch (error) {
      // Ağ hataları sonuç olarak döner; buraya yalnız beklenmeyen hata (ör. depolama erişimi) düşer
      reportClientError("customer-order.submit", error);
      notify.error(UNEXPECTED_ERROR);
    } finally {
      setSubmitting(false);
    }
  };

  const sendRequest = async (type: string, reason?: string, note?: string) => {
    const { business, table, activeRequests } = p;
    if (!business || !table) return;
    if (sendingRequest) return;
    notify.clear();

    // Hizmet talepleri için AUTHORIZED gerekli (ORDER_REQUEST hariç)
    if (type !== "ORDER_REQUEST" && session.status !== "AUTHORIZED") {
      notify.error("Masanız henüz açılmamış. Önce sipariş talebi oluşturun.");
      return;
    }

    const token = session.token || (await session.ensure(table.id));
    if (!token) {
      notify.error(session.blockedMsg || "Talep göndermek için masadaki QR kodu okutun.");
      return;
    }

    const isBlocked =
      (type === "CALL_WAITER" && (activeRequests["CALL_WAITER"] || activeRequests["CALL_WAITER_BLOCKED"])) ||
      (type === "PAYMENT_REQUEST" && (activeRequests["PAYMENT_REQUEST"] || activeRequests["PAYMENT_REQUEST_BLOCKED"])) ||
      (type === "ORDER_REQUEST" && activeRequests["ORDER_REQUEST"]);

    if (isBlocked) {
      notify.error(type === "PAYMENT_REQUEST" ? "Ödeme talebiniz zaten bekliyor." : "Devam eden bir talebiniz var. Lütfen bekleyin.");
      return;
    }

    setSendingRequest(true);
    try {
      // ✅ PAYMENT_REQUEST → özel ödeme endpointi
      const isPaymentRequest = type === "PAYMENT_REQUEST";
      const result = isPaymentRequest
        ? await sendPaymentRequest(token, { businessId: business.id, tableId: table.id, note: note || null })
        : await sendServiceRequest(token, {
            businessId: business.id,
            tableId: table.id,
            requestType: type,
            reason: reason || null,
            note: note || null,
          });

      if (result.ok) {
        const msgs: Record<string, string> = {
          CALL_WAITER: "Garson çağrıldı! 🙋",
          PAYMENT_REQUEST: "Ödeme talebi gönderildi! 💳",
          HELP_REQUEST: "Yardım talebi gönderildi! ℹ️",
          ORDER_REQUEST: "Sipariş talebi garsona iletildi. 📋",
        };
        notify.success(msgs[type] || "Talep gönderildi");
        p.onRequestSent();
        p.refreshRequests();
      } else {
        const code = errorCode(result);
        if (code === "CUSTOMER_DEVICE_BLOCKED") notify.error(BLOCKED_DEVICE);
        else if (isPaymentRequest && (result.status === 409 || code === "PAYMENT_REQUEST_ALREADY_EXISTS")) notify.error("Ödeme talebiniz zaten bekliyor.");
        else notify.error(result.error);
      }
    } catch (error) {
      reportClientError("customer-order.request", error);
      notify.error(UNEXPECTED_ERROR);
    } finally {
      setSendingRequest(false);
    }
  };

  return { submitOrder, sendRequest, submitting, sendingRequest };
}
