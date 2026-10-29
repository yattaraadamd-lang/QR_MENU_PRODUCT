"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useVisiblePolling } from "@/hooks/useVisiblePolling";
import { ACTIVE_REQUESTS_IDLE_POLL_MS, ACTIVE_REQUESTS_POLL_MS, LIVE_BILL_POLL_MS } from "./constants";
import type { ActiveRequests, AuthStatus, LiveBill } from "./types";

type Params = {
  businessId: string | undefined;
  tableId: string | undefined;
  token: string | null;
  status: AuthStatus;
  /** Bekleyen ORDER_REQUEST'in doğrulama kodu (garson masaya gelince söylenir) */
  onVerificationCode: (code: string) => void;
};

/** Masanın bekleyen hizmet talepleri ve onaylanmış siparişlerin canlı adisyonu */
export function useTableActivity({ businessId, tableId, token, status, onVerificationCode }: Params) {
  const [activeRequests, setActiveRequests] = useState<ActiveRequests>({});
  const [liveBill, setLiveBill] = useState<LiveBill>({ total: null, paid: 0 });
  const onCodeRef = useRef(onVerificationCode);
  useEffect(() => {
    onCodeRef.current = onVerificationCode;
  });

  const refreshRequests = useCallback(async () => {
    if (!tableId || !businessId) return;
    try {
      const headers: Record<string, string> = {};
      if (token) headers["x-session-token"] = token;
      const res = await fetch(`/api/customer/active-requests?tableId=${tableId}&businessId=${businessId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setActiveRequests(data.activeRequests || {});
        const code = data.requestDetails?.ORDER_REQUEST?.verificationCode;
        if (code) onCodeRef.current(code);
      }
    } catch { /* sessiz hata */ }
  }, [tableId, businessId, token]);

  // Bekleyen talep varken sonucu (garson gördü / tamamladı) hızlı göstermek için 5 sn, yokken 15 sn
  const hasActiveRequest = Object.values(activeRequests).some(Boolean);
  useVisiblePolling(
    refreshRequests,
    hasActiveRequest ? ACTIVE_REQUESTS_POLL_MS : ACTIVE_REQUESTS_IDLE_POLL_MS,
    !!(tableId && businessId),
  );

  // ✅ FAZ 4: Canlı adisyon barı — onaylanmış sipariş toplamını periyodik çek
  const refreshBill = useCallback(async () => {
    if (!token || status !== "AUTHORIZED") return;
    try {
      const res = await fetch("/api/customer/orders", { headers: { "x-session-token": token }, cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.bill) {
        setLiveBill({ total: Number(data.bill.totalAmount) || 0, paid: Number(data.bill.paidAmount) || 0 });
      } else if (data.orders) {
        // Fallback: siparişlerden hesapla
        const total = (data.orders as { status: string; totalPrice?: number | string }[]).reduce(
          (sum, o) => (["CANCELLED", "REJECTED"].includes(o.status) ? sum : sum + Number(o.totalPrice || 0)),
          0,
        );
        setLiveBill(prev => ({ ...prev, total }));
      }
    } catch { /* sessiz */ }
  }, [token, status]);

  // PENDING → AUTHORIZED geçişinde adisyon polling'i hemen başlar (enabled değişir)
  useVisiblePolling(refreshBill, LIVE_BILL_POLL_MS, status === "AUTHORIZED" && !!token);

  const activeCount = Object.values(activeRequests).filter(Boolean).length;

  return { activeRequests, activeCount, liveBill, refreshRequests };
}
