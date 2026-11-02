"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { useApiQuery } from "@/hooks/useApiQuery";
import { useBusinessSocket } from "@/hooks/useBusinessSocket";
import type { OrderDTO } from "@/components/orders/types";
import { ADMIN_ORDERS_URL, selectAdminOrders } from "./adminOrders.api";
import { filterOrders, orderTabs, type OrderTab } from "./orderTabs";

/** Sekme görünürken yenileme aralığı; yeni sipariş ve durum değişimi ayrıca soketle gelir */
const REFRESH_MS = 10_000;
const ORDER_EVENTS = ["new_order", "order_status_update", "payment_collected"];

/** Admin sipariş ekranı: liste, sekme filtresi, iptal penceresi */
export function useAdminOrdersPage() {
  const { data: session } = useSession();
  const query = useApiQuery(session?.user.businessId ? ADMIN_ORDERS_URL : null, {
    select: selectAdminOrders,
    refreshInterval: REFRESH_MS,
  });
  const orders = query.data ?? [];
  useBusinessSocket(ORDER_EVENTS, query.refresh);

  const [tab, setTab] = useState<OrderTab>("all");
  const [cancelling, setCancelling] = useState<OrderDTO | null>(null);

  const handleCancelled = () => {
    setCancelling(null);
    toast.info("Sipariş iptal edildi");
    void query.refresh();
  };

  return {
    query,
    total: orders.length,
    tab,
    setTab,
    tabs: orderTabs(orders),
    visible: filterOrders(orders, tab),
    cancelling,
    openCancel: setCancelling,
    closeCancel: () => setCancelling(null),
    handleCancelled,
  };
}
