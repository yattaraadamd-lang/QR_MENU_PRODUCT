"use client";

import { useCallback, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";
import type { CartApi } from "./useCart";
import type { CustomerSessionApi } from "./useCustomerSession";
import type { ActiveRequests, AuthStatus, Business, TableInfo } from "./types";

type Params = {
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
const TABLE_CLAIMED = "Bu masa başka bir aktif oturuma ait. Personelden yardım isteyin.";

/** Yetki durumuna göre sipariş (VIEW_ONLY → ORDER_REQUEST, AUTHORIZED → sipariş) ve hizmet talepleri */
export function useOrderActions(p: Params) {
  const { session, cart } = p;
  const [submitting, setSubmitting] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const clearError = useCallback(() => setActionError(null), []);

  // Açık <dialog> (top layer) varken toast modalın arkasında kalır: hata pencerenin içinde
  // (FormError) gösterilir, pencere yoksa toast
  const showError = (msg: string) => {
    if (document.querySelector("dialog[open]")) setActionError(msg);
    else toast.error(msg);
  };

  // ✅ Tek gerçek sipariş gönderme fonksiyonu — yalnız AUTHORIZED durumda çağrılır
  const sendActualOrder = async (token: string): Promise<boolean> => {
    const r = await fetch("/api/customer/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-session-token": token },
      body: JSON.stringify({
        items: cart.items.map(i => ({ productId: i.product.id, quantity: i.quantity, customerNote: i.customerNote || null })),
        note: p.orderNote || null,
        idempotencyKey: `ord_${uuidv4()}`,
      }),
    });
    if (r.ok) {
      cart.clear();
      p.onOrderSent();
      toast.success("Siparişiniz gönderildi! Garson onayı bekleniyor... ⏳");
      return true;
    }
    const d = await r.json();
    if (d.code === "CUSTOMER_DEVICE_BLOCKED") {
      showError(BLOCKED_DEVICE);
    } else if (d.code === "SESSION_NOT_AUTHORIZED_FOR_TABLE" || d.code === "SESSION_REVOKED") {
      session.setStatus("REVOKED");
      showError("Oturumunuz sonlanmış. Personelden yardım isteyin.");
    } else {
      showError(d.error || "Sipariş gönderilemedi");
      // Ürün stokta yok / kaldırılmış olabilir: menüyü 60 sn beklemeden yenile;
      // menü yenilenince sepetteki stoksuz ürünler temizlenir
      if (r.status === 400 || r.status === 404) p.refreshMenu();
    }
    return false;
  };

  // ✅ Yetkiye göre ana sipariş aksiyonu
  const submitOrder = async () => {
    const { business, table } = p;
    if (!cart.items.length || !business || !table) return;
    if (submitting) return;
    setActionError(null);

    // REVOKED veya TABLE_ALREADY_CLAIMED durumunda engelle
    if (session.status === "REVOKED" || session.status === "TABLE_ALREADY_CLAIMED") {
      showError(TABLE_CLAIMED);
      return;
    }

    setSubmitting(true);
    try {
      const token = session.token || (await session.ensure(table.id));
      if (!token) {
        showError(session.blockedMsg || "Sipariş vermek için masadaki QR kodu okutun.");
        return;
      }

      // ✅ FIX: Canonical status'u önce kontrol et — local state stale olabilir
      let effective: AuthStatus = session.status;
      try {
        const server = await session.fetchStatus(token);
        if (server.ok && server.status) {
          // Route-table eşleşme kontrolü
          if (server.businessId !== p.routeBusinessId || server.tableId !== table.id) {
            showError("Oturum farklı masaya ait. Lütfen QR kodu tekrar okutun.");
            return;
          }
          effective = server.status;
          if (effective !== session.status) session.setStatus(effective);

          if (effective === "REVOKED") {
            showError("Oturumunuz iptal edilmiş. Personelden yardım isteyin.");
            return;
          }
          if (effective === "TABLE_ALREADY_CLAIMED") {
            showError(TABLE_CLAIMED);
            return;
          }
        } else if (server.code === "SESSION_REVOKED") {
          session.setStatus("REVOKED");
          showError("Oturumunuz iptal edilmiş. Personelden yardım isteyin.");
          return;
        } else if (server.code === "SESSION_EXPIRED" || server.code === "SESSION_NOT_FOUND") {
          showError("Oturum süresi dolmuş. QR kodu tekrar okutun.");
          return;
        }
      } catch {
        // Network error — local state ile devam et
      }

      // ── AUTHORIZED: Aynı tıklamada gerçek siparişi gönder
      if (effective === "AUTHORIZED") {
        await sendActualOrder(token);
        return;
      }

      // ── PENDING: Zaten bekliyor, ikinci ORDER_REQUEST oluşturma
      if (effective === "PENDING") {
        showError("Garson onayı bekleniyor. Lütfen bekleyin.");
        return;
      }

      // ── VIEW_ONLY: ORDER_REQUEST oluştur (sepet verileri ile)
      if (effective === "VIEW_ONLY") {
        const r = await fetch("/api/customer/service-requests", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-session-token": token },
          body: JSON.stringify({
            businessId: business.id,
            tableId: table.id,
            requestType: "ORDER_REQUEST",
            reason: "Sipariş vermek istiyorum",
            items: cart.items.map(i => ({ productId: i.product.id, quantity: i.quantity, customerNote: i.customerNote || null })),
            orderNote: p.orderNote || null,
            idempotencyKey: `or_${uuidv4()}`,
          }),
        });
        const d = await r.json();
        if (r.ok) {
          session.setStatus("PENDING");
          if (d.serviceRequest?.verificationCode) session.setVerificationCode(d.serviceRequest.verificationCode);
          // ✅ Sepet korunur — ORDER_REQUEST ile temizleme
          toast.success("Sipariş talebiniz oluşturuldu. Garson onayı bekleniyor.");
        } else if (d.code === "CUSTOMER_DEVICE_BLOCKED") {
          showError(BLOCKED_DEVICE);
        } else if (d.code === "TABLE_ALREADY_CLAIMED") {
          session.setStatus("TABLE_ALREADY_CLAIMED");
          showError(TABLE_CLAIMED);
        } else if (d.code === "TABLE_REQUEST_PENDING") {
          showError("Bu masa için başka bir cihazın bekleyen talebi var. Siparişi o cihazdan verin.");
        } else if (d.code === "ORDER_REQUEST_PENDING") {
          session.setStatus("PENDING");
          if (d.serviceRequest?.verificationCode) session.setVerificationCode(d.serviceRequest.verificationCode);
          showError("Bekleyen talebiniz var. Garson onayı bekleniyor.");
        } else if (d.code === "SESSION_ALREADY_AUTHORIZED") {
          // ✅ FIX: Canonical doğrula + aynı tıklamada sipariş gönder
          try {
            const recheck = await session.fetchStatus(token);
            session.setStatus("AUTHORIZED");
            if (recheck.ok && recheck.status === "AUTHORIZED") await sendActualOrder(token);
            else toast.success("Masanız açık! Siparişi Gönder butonuna basın.");
          } catch {
            session.setStatus("AUTHORIZED");
            toast.success("Masanız açık! Siparişi Gönder butonuna basın.");
          }
        } else {
          showError(d.error || "Talep gönderilemedi");
        }
      }
    } catch {
      showError("Bağlantı hatası");
    } finally {
      setSubmitting(false);
    }
  };

  const sendRequest = async (type: string, reason?: string, note?: string) => {
    const { business, table, activeRequests } = p;
    if (!business || !table) return;
    if (sendingRequest) return;
    setActionError(null);

    // Hizmet talepleri için AUTHORIZED gerekli (ORDER_REQUEST hariç)
    if (type !== "ORDER_REQUEST" && session.status !== "AUTHORIZED") {
      showError("Masanız henüz açılmamış. Önce sipariş talebi oluşturun.");
      return;
    }

    const token = session.token || (await session.ensure(table.id));
    if (!token) {
      showError(session.blockedMsg || "Talep göndermek için masadaki QR kodu okutun.");
      return;
    }

    const isBlocked =
      (type === "CALL_WAITER" && (activeRequests["CALL_WAITER"] || activeRequests["CALL_WAITER_BLOCKED"])) ||
      (type === "PAYMENT_REQUEST" && (activeRequests["PAYMENT_REQUEST"] || activeRequests["PAYMENT_REQUEST_BLOCKED"])) ||
      (type === "ORDER_REQUEST" && activeRequests["ORDER_REQUEST"]);

    if (isBlocked) {
      showError(type === "PAYMENT_REQUEST" ? "Ödeme talebiniz zaten bekliyor." : "Devam eden bir talebiniz var. Lütfen bekleyin.");
      return;
    }

    setSendingRequest(true);
    try {
      // ✅ PAYMENT_REQUEST → özel ödeme endpointi
      const isPaymentRequest = type === "PAYMENT_REQUEST";
      const endpoint = isPaymentRequest ? "/api/customer/payment-requests" : "/api/customer/service-requests";
      const payload = isPaymentRequest
        ? { businessId: business.id, tableId: table.id, note: note || null }
        : { businessId: business.id, tableId: table.id, requestType: type, reason: reason || null, note: note || null };

      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-session-token": token },
        body: JSON.stringify(payload),
      });

      if (r.ok) {
        const msgs: Record<string, string> = {
          CALL_WAITER: "Garson çağrıldı! 🙋",
          PAYMENT_REQUEST: "Ödeme talebi gönderildi! 💳",
          HELP_REQUEST: "Yardım talebi gönderildi! ℹ️",
          ORDER_REQUEST: "Sipariş talebi garsona iletildi. 📋",
        };
        toast.success(msgs[type] || "Talep gönderildi");
        p.onRequestSent();
        p.refreshRequests();
      } else {
        const d = await r.json();
        if (d.code === "CUSTOMER_DEVICE_BLOCKED") showError(BLOCKED_DEVICE);
        else if (isPaymentRequest && (r.status === 409 || d.code === "PAYMENT_REQUEST_ALREADY_EXISTS")) showError("Ödeme talebiniz zaten bekliyor.");
        else showError(d.error || "Talep gönderilemedi");
      }
    } catch {
      showError("Bağlantı hatası");
    } finally {
      setSendingRequest(false);
    }
  };

  return { submitOrder, sendRequest, submitting, sendingRequest, actionError, clearError };
}
