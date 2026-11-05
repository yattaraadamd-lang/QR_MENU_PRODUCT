"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useApiQuery } from "@/hooks/useApiQuery";
import { useBusinessSocket } from "@/hooks/useBusinessSocket";
import type { QueueFilter } from "@/components/staff/StaffQueueHeader";
import { REQUEST_SOCKET_EVENTS } from "./requestModel";
import { useRequestActions } from "./useRequestActions";
import { requestsUrl, selectRequests } from "./waiterRequests.api";

/** Sekme görünürken yenileme aralığı; çağrılar ayrıca soketle anında gelir */
const REFRESH_MS = 5000;

/** Garson talepleri: filtre, liste, durum ilerletme, masa açma ve sipariş talebini reddetme */
export function useWaiterRequestsPage() {
  const { data: session } = useSession();
  const [filter, setFilter] = useState<QueueFilter>("active");
  // Filtre değişince eski istek iptal edilir; sekme gizliyken polling durur
  const query = useApiQuery(session?.user.businessId ? requestsUrl(filter) : null, {
    select: selectRequests,
    refreshInterval: REFRESH_MS,
  });
  const requests = query.data ?? [];
  useBusinessSocket(REQUEST_SOCKET_EVENTS, query.refresh);
  const actions = useRequestActions(query.refresh);

  const orderRequestsByTable = new Map<string, number>();
  for (const request of requests) {
    if (request.requestType === "ORDER_REQUEST" && request.status === "PENDING") {
      orderRequestsByTable.set(request.tableId, (orderRequestsByTable.get(request.tableId) ?? 0) + 1);
    }
  }

  return {
    orderRequestsByTable,
    filter,
    setFilter,
    query,
    requests,
    pendingCount: requests.filter((r) => r.status === "PENDING").length,
    ...actions,
  };
}
