"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { useApiQuery } from "@/hooks/useApiQuery";
import { useConfirm } from "@/components/ui/useConfirm";
import { BUSINESSES_URL, businessesApi, selectBusinesses } from "./businesses.api";
import type { BusinessDTO } from "./types";

/** İşletme listesi, aktif/pasif geçişi (pasife alma onaylı), yeni işletme penceresi */
export function useBusinessesPage() {
  const { data: session } = useSession();
  const query = useApiQuery(session?.user.role === "SUPER_ADMIN" ? BUSINESSES_URL : null, {
    select: selectBusinesses,
  });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirm, confirmDialog] = useConfirm();

  const toggleActive = async (business: BusinessDTO) => {
    const activate = !business.isActive;
    if (!activate) {
      const ok = await confirm({
        title: `${business.name} pasife alınsın mı?`,
        description: "İşletme pasif duruma alınacak. Daha sonra yeniden aktif edebilirsiniz.",
        confirmText: "Pasif Et",
        variant: "warning",
      });
      if (!ok) return;
    }
    setBusyId(business.id);
    const result = await businessesApi.setActive(business.id, activate);
    setBusyId(null);
    if (result.ok) {
      toast.success(activate ? `${business.name} aktif edildi` : `${business.name} pasife alındı`);
      void query.refresh();
    } else if (!result.aborted) {
      toast.error(result.error);
    }
  };

  // Pencere kapandıktan sonra toast (açık <dialog> toast'ı örterdi)
  const handleCreated = (message: string) => {
    setCreating(false);
    toast.success(message);
    void query.refresh();
  };

  return {
    query,
    businesses: query.data ?? [],
    busyId,
    toggleActive,
    creating,
    openCreate: () => setCreating(true),
    closeCreate: () => setCreating(false),
    handleCreated,
    confirmDialog,
  };
}
