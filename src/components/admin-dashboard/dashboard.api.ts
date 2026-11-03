import type { DashboardSummaryDTO } from "./types";

export const DASHBOARD_SUMMARY_URL = "/api/admin/dashboard/summary";

/** useApiQuery `select`: uç `{ success, data }` döner; hata gövdesi (5xx) useApiQuery'de hata olur */
export function selectSummary(json: unknown): DashboardSummaryDTO | null {
  return (json as { data?: DashboardSummaryDTO } | null)?.data ?? null;
}
