"use client";

import { useState } from "react";
import { reportClientError } from "@/lib/report-error";
import { BLOCKED_DEVICE_MESSAGE, UNEXPECTED_ERROR_MESSAGE, type ActionNotifier } from "./actionNotifier";
import { errorCode, requestCodeOf, sendOrder, sendOrderRequest, type CartLine } from "./customer.api";
import type { CartApi } from "./useCart";
import type { CustomerSessionApi } from "./useCustomerSession";
import type { AuthStatus, Business, TableInfo } from "./types";

type Params = {
  notify: ActionNotifier;
  /** Rota parametresi: oturumun bu masaya ait olduğu buna göre doğrulanır */
  routeBusinessId: string;
  business: Business | null;
  table: TableInfo | null;
  session: CustomerSessionApi;
  cart: CartApi;
  orderNote: string;
  /** Sipariş başarıyla gitti: not ve mobil sepet kapatılır */
  onOrderSent: () => void;
  refreshMenu: () => void;
};

const TABLE_CLAIMED = "Bu masa başka bir aktif oturuma ait. Personelden yardım isteyin.";
const SESSION_REVOKED = "Oturumunuz iptal edilmiş. Personelden yardım isteyin.";

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

/**
 * Sepeti yetki durumuna göre gönderir (FE-ARCH-3.9c): AUTHORIZED → sipariş, VIEW_ONLY → masa
 * açma talebi (ORDER_REQUEST), PENDING → garson onayı beklenir. Hizmet talepleri useServiceRequest'te.
 */
export function useOrderSubmit(p: Params) {
  const { session, cart, notify } = p;
  const [submitting, setSubmitting] = useState(false);

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
      notify.error(BLOCKED_DEVICE_MESSAGE);
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

  /**
   * ✅ Canonical durum: yerel durum eskimiş olabilir, sunucuya sorulur. Sipariş durmalıysa
   * kullanıcıya bildirip null döner. Ağ hatasında yerel durumla devam edilir.
   */
  const confirmStatus = async (token: string, table: TableInfo): Promise<AuthStatus | null> => {
    const local = session.status;
    const server = await session.fetchStatus(token);
    if (server.ok && server.status) {
      // Route-table eşleşme kontrolü
      if (server.businessId !== p.routeBusinessId || server.tableId !== table.id) {
        notify.error("Oturum farklı masaya ait. Lütfen QR kodu tekrar okutun.");
        return null;
      }
      const effective = server.status;
      if (effective !== local) session.setStatus(effective);
      if (effective === "REVOKED") {
        notify.error(SESSION_REVOKED);
        return null;
      }
      if (effective === "TABLE_ALREADY_CLAIMED") {
        notify.error(TABLE_CLAIMED);
        return null;
      }
      return effective;
    }
    if (server.code === "SESSION_REVOKED") {
      session.setStatus("REVOKED");
      notify.error(SESSION_REVOKED);
      return null;
    }
    if (server.code === "SESSION_EXPIRED" || server.code === "SESSION_NOT_FOUND") {
      notify.error("Oturum süresi dolmuş. QR kodu tekrar okutun.");
      return null;
    }
    return local;
  };

  // ── VIEW_ONLY: masa açma talebi (ORDER_REQUEST) sepet verileriyle; sepet korunur
  const requestTableOpening = async (token: string, business: Business, table: TableInfo) => {
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
      notify.error(BLOCKED_DEVICE_MESSAGE);
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

      const status = await confirmStatus(token, table);
      // ── AUTHORIZED: aynı tıklamada gerçek siparişi gönder
      if (status === "AUTHORIZED") await sendActualOrder(token);
      // ── PENDING: zaten bekliyor, ikinci ORDER_REQUEST oluşturma
      else if (status === "PENDING") notify.error("Garson onayı bekleniyor. Lütfen bekleyin.");
      else if (status === "VIEW_ONLY") await requestTableOpening(token, business, table);
    } catch (error) {
      // Ağ hataları sonuç olarak döner; buraya yalnız beklenmeyen hata (ör. depolama erişimi) düşer
      reportClientError("customer-order.submit", error);
      notify.error(UNEXPECTED_ERROR_MESSAGE);
    } finally {
      setSubmitting(false);
    }
  };

  return { submitOrder, submitting };
}
