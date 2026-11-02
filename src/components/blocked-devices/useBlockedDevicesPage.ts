"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { useApiQuery } from "@/hooks/useApiQuery";
import { blocksUrl, selectBlockPage } from "./blockedDevices.api";
import type { BlockFilter, DeviceBlockDTO } from "./types";

/** Engelli cihazlar: durum filtresi, sayfalama, engel kaldırma penceresi */
export function useBlockedDevicesPage() {
  const { data: session } = useSession();
  const [filter, setFilterState] = useState<BlockFilter>("active");
  const [page, setPage] = useState(1);
  // Filtre/sayfa değişince eski istek iptal edilir; engeller nadiren değişir, polling yok
  const query = useApiQuery(session?.user.businessId ? blocksUrl(filter, page) : null, { select: selectBlockPage });

  const [unblocking, setUnblocking] = useState<DeviceBlockDTO | null>(null);

  // Filtre değişince ilk sayfaya dön
  const setFilter = (next: BlockFilter) => {
    setFilterState(next);
    setPage(1);
  };

  const handleUnblocked = () => {
    setUnblocking(null);
    toast.success("Cihaz engeli başarıyla kaldırıldı.");
    void query.refresh();
  };

  return {
    query,
    blocks: query.data?.blocks ?? [],
    pagination: query.data?.pagination,
    filter,
    setFilter,
    setPage,
    unblocking,
    openUnblock: setUnblocking,
    closeUnblock: () => setUnblocking(null),
    handleUnblocked,
  };
}
