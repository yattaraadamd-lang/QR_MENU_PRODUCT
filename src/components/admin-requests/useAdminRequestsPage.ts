"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useApiQuery } from "@/hooks/useApiQuery";
import { useBusinessSocket } from "@/hooks/useBusinessSocket";
import { REQUEST_SOCKET_EVENTS } from "@/components/requests/requestModel";
import { useRequestActions } from "@/components/requests/useRequestActions";
import { ADMIN_REQUESTS_URL, selectAdminRequests } from "./adminRequests.api";
import { filterRequests, requestTabs, type RequestTab } from "./requestTabs";

/** Sekme görünürken yenileme aralığı; yeni talep ve masa açılışı ayrıca soketle gelir */
const REFRESH_MS = 5000;

/** Admin talep ekranı: tüm talepler, sekme filtresi, garson ekranıyla aynı eylemler */
export function useAdminRequestsPage() {
  const { data: session } = useSession();
  const query = useApiQuery(session?.user.businessId ? ADMIN_REQUESTS_URL : null, {
    select: selectAdminRequests,
    refreshInterval: REFRESH_MS,
  });
  const requests = query.data ?? [];
  useBusinessSocket(REQUEST_SOCKET_EVENTS, query.refresh);
  const actions = useRequestActions(query.refresh);
  const [tab, setTab] = useState<RequestTab>("active");

  return {
    query,
    tab,
    setTab,
    tabs: requestTabs(requests),
    visible: filterRequests(requests, tab),
    ...actions,
  };
}
