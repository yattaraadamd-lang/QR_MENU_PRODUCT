"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useApiQuery } from "@/hooks/useApiQuery";
import { useBusinessSocket } from "@/hooks/useBusinessSocket";
import { useNow } from "@/hooks/useNow";
import { PAYMENTS_URL, selectPaymentRecords } from "./adminPayments.api";
import { defaultDateRange, filterPayments, summarizePayments } from "./paymentHistoryModel";
import type { DateRange, PaymentFilter, PaymentRecordDTO } from "./types";

/** Sekme görünürken yenileme aralığı; ödeme olayları ayrıca soketle anında gelir */
const REFRESH_MS = 10_000;
const PAYMENT_EVENTS = ["payment_request", "payment_collected"];
/** "Bugün" ve tarih sınırı dakikalık hassasiyetle yeter */
const CLOCK_TICK_MS = 60_000;

/** Ödeme geçmişi: durum filtresi, yerel takvime göre tarih aralığı, özet */
export function useAdminPaymentsPage() {
  const { data: session } = useSession();
  const query = useApiQuery(session?.user.businessId ? PAYMENTS_URL : null, {
    select: selectPaymentRecords,
    refreshInterval: REFRESH_MS,
  });
  useBusinessSocket(PAYMENT_EVENTS, query.refresh);

  const now = useNow(CLOCK_TICK_MS);
  const [filter, setFilter] = useState<PaymentFilter>("ALL");
  const [range, setRange] = useState<DateRange>(() => defaultDateRange(Date.now()));
  const payments: readonly PaymentRecordDTO[] = query.data ?? [];

  return {
    query,
    filter,
    setFilter,
    range,
    setStart: (start: string) => setRange((prev) => ({ ...prev, start })),
    setEnd: (end: string) => setRange((prev) => ({ ...prev, end })),
    today: defaultDateRange(now).end,
    visible: filterPayments(payments, filter, range),
    summary: summarizePayments(payments, now),
  };
}
