"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { ApiResult } from "@/lib/api-client";
import { useConfirm } from "@/components/ui/useConfirm";
import type { RequestStatus, ServiceRequestDTO } from "./types";
import { waiterRequestsApi } from "./waiterRequests.api";

/**
 * Talep eylemleri (garson ve admin ekranı aynı uçları kullanır): durum ilerletme, masa açma,
 * sipariş talebini reddetme. Başarıda `refresh` çağrılır; hata toast'ta (pencere açık değil).
 */
export function useRequestActions(refresh: () => Promise<unknown>) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, confirmDialog] = useConfirm();

  /** Bir talep üzerinde istek: o kartın düğmeleri kilitlenir */
  const runFor = async (id: string, action: () => Promise<ApiResult<unknown>>, success?: string) => {
    setBusyId(id);
    const result = await action();
    setBusyId(null);
    if (result.ok) {
      if (success) toast.success(success);
      void refresh();
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

  return { busyId, updateStatus, openTable, rejectOrderRequest, confirmDialog };
}
