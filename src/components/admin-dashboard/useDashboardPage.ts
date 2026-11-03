"use client";

import { useSession } from "next-auth/react";
import { useApiQuery } from "@/hooks/useApiQuery";
import { DASHBOARD_SUMMARY_URL, selectSummary } from "./dashboard.api";
import { useRevenueVisibility } from "./useRevenueVisibility";

/** Özet 9 sorgu çalıştırır: soket yerine seyrek polling (sekme gizliyken durur) */
const REFRESH_MS = 30_000;

/** Admin dashboard: özet, son siparişler, ciro gizleme tercihi */
export function useDashboardPage() {
  const { data: session } = useSession();
  const query = useApiQuery(session?.user.businessId ? DASHBOARD_SUMMARY_URL : null, {
    select: selectSummary,
    refreshInterval: REFRESH_MS,
  });

  return {
    query,
    summary: query.data ?? null,
    userName: session?.user.name,
    ...useRevenueVisibility(),
  };
}
