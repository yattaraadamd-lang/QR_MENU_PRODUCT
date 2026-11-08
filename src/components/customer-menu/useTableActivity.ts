"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useVisiblePolling } from "@/hooks/useVisiblePolling";
import { ACTIVE_REQUESTS_IDLE_POLL_MS, ACTIVE_REQUESTS_POLL_MS, LIVE_BILL_POLL_MS } from "./constants";
import { getActiveRequests, getLiveBill } from "./customer.api";
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

  // İstek başarısızsa son durum ekranda kalır; sonraki yoklama yeniler
  const refreshRequests = useCallback(async () => {
    if (!tableId || !businessId) return;
    const activity = await getActiveRequests(businessId, tableId, token);
    if (!activity) return;
    setActiveRequests(activity.activeRequests);
    if (activity.verificationCode) onCodeRef.current(activity.verificationCode);
  }, [tableId, businessId, token]);

  // Bekleyen talep varken sonucu (garson gördü / tamamladı) hızlı göstermek için 5 sn, yokken 15 sn
  const hasActiveRequest = Object.values(activeRequests).some(Boolean);
  useVisiblePolling(
    refreshRequests,
    hasActiveRequest ? ACTIVE_REQUESTS_POLL_MS : ACTIVE_REQUESTS_IDLE_POLL_MS,
    !!(tableId && businessId),
  );

  // ✅ FAZ 4: Canlı adisyon barı — onaylanmış sipariş toplamını periyodik çek.
  // Adisyon kaydı yoksa toplam siparişlerden gelir ve ödenen tutar korunur.
  const refreshBill = useCallback(async () => {
    if (!token || status !== "AUTHORIZED") return;
    const bill = await getLiveBill(token);
    if (!bill) return;
    setLiveBill((prev) => ({ total: bill.total, paid: bill.paid ?? prev.paid }));
  }, [token, status]);

  // PENDING → AUTHORIZED geçişinde adisyon polling'i hemen başlar (enabled değişir)
  useVisiblePolling(refreshBill, LIVE_BILL_POLL_MS, status === "AUTHORIZED" && !!token);

  const activeCount = Object.values(activeRequests).filter(Boolean).length;

  return { activeRequests, activeCount, liveBill, refreshRequests };
}
