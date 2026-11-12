"use client";

import { useState } from "react";
import { reportClientError } from "@/lib/report-error";
import { BLOCKED_DEVICE_MESSAGE, UNEXPECTED_ERROR_MESSAGE, type ActionNotifier } from "./actionNotifier";
import { errorCode, sendPaymentRequest, sendServiceRequest } from "./customer.api";
import type { CustomerSessionApi } from "./useCustomerSession";
import type { ActiveRequests, Business, TableInfo } from "./types";

type Params = {
  notify: ActionNotifier;
  business: Business | null;
  table: TableInfo | null;
  session: CustomerSessionApi;
  activeRequests: ActiveRequests;
  /** Hizmet talebi gitti: açık pencereler kapatılır */
  onRequestSent: () => void;
  refreshRequests: () => void;
};

const SUCCESS_MESSAGES: Record<string, string> = {
  CALL_WAITER: "Garson çağrıldı! 🙋",
  PAYMENT_REQUEST: "Ödeme talebi gönderildi! 💳",
  HELP_REQUEST: "Yardım talebi gönderildi! ℹ️",
  ORDER_REQUEST: "Sipariş talebi garsona iletildi. 📋",
};

/**
 * Hizmet talepleri (FE-ARCH-3.9c): garson çağırma, yardım ve ödeme talebi. Masa açık
 * (AUTHORIZED) olmalı; bekleyen aynı talep ya da birbirini engelleyen çağrı/ödeme varsa gitmez.
 * Sepetin gönderimi useOrderSubmit'te.
 */
export function useServiceRequest(p: Params) {
  const { session, notify } = p;
  const [sendingRequest, setSendingRequest] = useState(false);

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
        notify.success(SUCCESS_MESSAGES[type] || "Talep gönderildi");
        p.onRequestSent();
        p.refreshRequests();
      } else {
        const code = errorCode(result);
        if (code === "CUSTOMER_DEVICE_BLOCKED") notify.error(BLOCKED_DEVICE_MESSAGE);
        else if (isPaymentRequest && (result.status === 409 || code === "PAYMENT_REQUEST_ALREADY_EXISTS")) notify.error("Ödeme talebiniz zaten bekliyor.");
        else notify.error(result.error);
      }
    } catch (error) {
      reportClientError("customer-order.request", error);
      notify.error(UNEXPECTED_ERROR_MESSAGE);
    } finally {
      setSendingRequest(false);
    }
  };

  return { sendRequest, sendingRequest };
}
