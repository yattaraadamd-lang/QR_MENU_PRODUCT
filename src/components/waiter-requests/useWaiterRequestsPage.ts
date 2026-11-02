"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { useApiQuery } from "@/hooks/useApiQuery";
import { useBusinessSocket } from "@/hooks/useBusinessSocket";
import type { ApiResult } from "@/lib/api-client";
import type { QueueFilter } from "@/components/staff/StaffQueueHeader";
import { useConfirm } from "@/components/ui/useConfirm";
import type { RequestStatus, ServiceRequestDTO } from "./types";
import { requestsUrl, selectRequests, waiterRequestsApi } from "./waiterRequests.api";

/** Sekme görünürken yenileme aralığı; çağrılar ayrıca soketle anında gelir */
const REFRESH_MS = 5000;
const REQUEST_EVENTS = [
  "call_waiter",
  "payment_request",
  "help_request",
  "service_request",
  "order_request_update",
  "table_opened",
];

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
  useBusinessSocket(REQUEST_EVENTS, query.refresh);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, confirmDialog] = useConfirm();

  /** Bir talep üzerinde istek: düğmeler kilitlenir, hata toast'ta (pencere açık değil) */
  const runFor = async (id: string, action: () => Promise<ApiResult<unknown>>, success?: string) => {
    setBusyId(id);
    const result = await action();
    setBusyId(null);
    if (result.ok) {
      if (success) toast.success(success);
      void query.refresh();
    } else if (!result.aborted) {
      toast.error(result.error);
    }
    return result.ok;
  };

  const updateStatus = (request: ServiceRequestDTO, status: RequestStatus) =>
    runFor(request.id, () => waiterRequestsApi.updateStatus(request.id, status));

  const openTable = (request: ServiceRequestDTO, code: string) =>
    runFor(request.id, () => waiterRequestsApi.openTable(request.id, code), "Masa açıldı, müşteri sipariş verebilir.");

  const rejectOrderRequest = async (request: ServiceRequestDTO) => {
    const confirmed = await confirm({
      title: "Sipariş talebi reddedilsin mi?",
      description:
        "Masada müşteri bulunmadığını onaylıyorsunuz. Müşteri oturumu kapatılacak ve bu cihaz işletmede engellenecek.",
      confirmText: "Reddet ve engelle",
    });
    if (!confirmed) return;
    await runFor(request.id, () => waiterRequestsApi.rejectOrderRequest(request.id), "Sipariş talebi reddedildi.");
  };

  return {
    filter,
    setFilter,
    query,
    requests,
    pendingCount: requests.filter((r) => r.status === "PENDING").length,
    busyId,
    updateStatus,
    openTable,
    rejectOrderRequest,
    confirmDialog,
  };
}
