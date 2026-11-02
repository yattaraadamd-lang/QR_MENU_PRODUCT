"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { useApiQuery } from "@/hooks/useApiQuery";
import { useBusinessSocket } from "@/hooks/useBusinessSocket";
import type { OrderDTO } from "@/components/orders/types";
import { stopStatusFor, type OrderStep } from "./orderModel";
import type { OrderFilter } from "./types";
import { ordersUrl, selectOrders, waiterOrdersApi } from "./waiterOrders.api";

/** Sekme görünürken yenileme aralığı; yeni sipariş ve durum değişimi ayrıca soketle gelir */
const REFRESH_MS = 6000;
const ORDER_EVENTS = ["new_order", "order_status_update"];

/** Garson sipariş ekranı: filtre, liste, durum ilerletme ve iptal/red penceresi */
export function useWaiterOrdersPage() {
  const { data: session } = useSession();
  const [filter, setFilter] = useState<OrderFilter>("active");
  // Filtre değişince eski istek iptal edilir; sekme gizliyken polling durur
  const query = useApiQuery(session?.user.businessId ? ordersUrl(filter) : null, {
    select: selectOrders,
    refreshInterval: REFRESH_MS,
  });
  const orders = query.data ?? [];
  useBusinessSocket(ORDER_EVENTS, query.refresh);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [stopping, setStopping] = useState<OrderDTO | null>(null);

  // İyimser: kart hemen yeni durumda; hata olursa yenileme geri alır. Pencere yok → toast
  const advance = async (order: OrderDTO, step: OrderStep) => {
    setBusyId(order.id);
    query.mutate((prev) => (prev ?? []).map((o) => (o.id === order.id ? { ...o, status: step.next } : o)));
    const result = await waiterOrdersApi.updateStatus(order.id, { status: step.next });
    setBusyId(null);
    void query.refresh();
    if (result.ok) toast.success(step.success);
    else if (!result.aborted) toast.error(result.error);
  };

  // Bekleyen sipariş reddedilir, kabul edilmiş olan iptal edilir
  const stopTarget = stopping ? stopStatusFor(stopping.status) : null;

  const handleStopped = () => {
    setStopping(null);
    toast.info(stopTarget === "REJECTED" ? "Sipariş reddedildi" : "Sipariş iptal edildi");
    void query.refresh();
  };

  return {
    filter,
    setFilter,
    query,
    orders,
    pendingCount: orders.filter((o) => o.status === "PENDING").length,
    busyId,
    advance,
    stopping,
    stopTarget,
    openStop: setStopping,
    closeStop: () => setStopping(null),
    handleStopped,
  };
}
