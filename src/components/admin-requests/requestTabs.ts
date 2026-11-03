import type { FilterTab } from "@/components/ui/FilterTabs";
import { isOpenRequest } from "@/components/waiter-requests/requestModel";
import type { ServiceRequestDTO } from "@/components/waiter-requests/types";

export type RequestTab = "active" | "completed" | "cancelled" | "all";

const MATCHERS: Readonly<Record<RequestTab, (request: ServiceRequestDTO) => boolean>> = {
  active: isOpenRequest,
  completed: (r) => r.status === "COMPLETED",
  cancelled: (r) => r.status === "CANCELLED",
  all: () => true,
};

const TAB_DEFS: readonly Omit<FilterTab<RequestTab>, "count">[] = [
  { value: "active", label: "Aktif", tone: "warning" },
  { value: "completed", label: "Tamamlanan", tone: "success" },
  { value: "cancelled", label: "İptal Edilen", tone: "danger" },
  { value: "all", label: "Tümü" },
];

export function filterRequests<T extends ServiceRequestDTO>(requests: readonly T[], tab: RequestTab): T[] {
  return requests.filter(MATCHERS[tab]);
}

/** Sekmeler sayaçlarıyla; sayılar seçili sekmeden bağımsız hep görünür */
export function requestTabs(requests: readonly ServiceRequestDTO[]): FilterTab<RequestTab>[] {
  return TAB_DEFS.map((tab) => ({ ...tab, count: requests.filter(MATCHERS[tab.value]).length }));
}
