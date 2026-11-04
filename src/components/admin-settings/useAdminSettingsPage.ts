"use client";

import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { useApiQuery } from "@/hooks/useApiQuery";
import { BUSINESS_URL, selectBusiness } from "./business.api";
import type { BusinessDTO } from "./types";

/** İşletme ayarları: bilgileri yükler; kayıttan sonra kenar çubuğundaki adı da tazeler */
export function useAdminSettingsPage() {
  const { data: session, update } = useSession();
  const query = useApiQuery(session?.user.businessId ? BUSINESS_URL : null, { select: selectBusiness });

  const handleSaved = (saved: BusinessDTO) => {
    query.mutate(() => saved);
    toast.success("Ayarlar kaydedildi");
    if (saved.name !== session?.user.businessName) void update();
  };

  return { query, business: query.data ?? null, handleSaved };
}
