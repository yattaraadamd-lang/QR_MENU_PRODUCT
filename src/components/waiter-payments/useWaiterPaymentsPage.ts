"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { useApiQuery } from "@/hooks/useApiQuery";
import { useBusinessSocket } from "@/hooks/useBusinessSocket";
import type { WaiterPaymentDTO } from "./types";
import { selectWaiterPayments } from "./waiterPayments.api";

/** Sekme görünürken yenileme aralığı; ödeme olayları ayrıca soketle anında gelir */
const REFRESH_MS = 5000;
const PAYMENT_EVENTS = [
  "payment_request",
  "payment_approval_requested",
  "payment_approved",
  "payment_rejected",
  "payment_collected",
];

/** Garson ödeme talepleri ekranının verisi ve eylemleri */
export function useWaiterPaymentsPage() {
  const { data: session } = useSession();
  // Oturum gelmeden istek atılmaz; sekme gizliyken polling durur
  const query = useApiQuery(session?.user.businessId ? "/api/waiter/payments" : null, {
    select: selectWaiterPayments,
    refreshInterval: REFRESH_MS,
  });
  useBusinessSocket(PAYMENT_EVENTS, query.refresh);

  const [selected, setSelected] = useState<WaiterPaymentDTO | null>(null);

  // Pencere kapandıktan sonra toast: açık <dialog> toast'ı örterdi
  const handleSent = () => {
    setSelected(null);
    toast.success("Ödeme bilgisi admin onayına gönderildi!");
    void query.refresh();
  };

  return {
    query,
    payments: query.data ?? [],
    selected,
    open: setSelected,
    close: () => setSelected(null),
    handleSent,
  };
}
