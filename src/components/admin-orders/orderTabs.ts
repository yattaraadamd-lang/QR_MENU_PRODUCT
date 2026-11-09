import type { FilterTab } from "@/components/ui/FilterTabs";
import { ACTIVE_STATUSES, STOPPED_STATUSES } from "@/components/orders/orderStatus";
import type { AdminOrderDTO } from "@/components/orders/types";

/** Admin sipariş sekmeleri: "Bekleyen Ödeme" = servis edilmiş ama tamamı ödenmemiş */
export type OrderTab = "all" | "active" | "pending_payment" | "completed" | "cancelled";

const MATCHERS: Readonly<Record<OrderTab, (order: AdminOrderDTO) => boolean>> = {
  all: () => true,
  active: (o) => ACTIVE_STATUSES.includes(o.status),
  pending_payment: (o) => o.status === "SERVED" && (o.paymentStatus === "UNPAID" || o.paymentStatus === "PARTIALLY_PAID"),
  completed: (o) => o.status === "SERVED" && o.paymentStatus === "PAID",
  cancelled: (o) => STOPPED_STATUSES.includes(o.status),
};

const TAB_DEFS: readonly Omit<FilterTab<OrderTab>, "count">[] = [
  { value: "all", label: "Tümü" },
  { value: "active", label: "Aktif", tone: "warning" },
  { value: "pending_payment", label: "Bekleyen Ödeme", tone: "purple" },
  { value: "completed", label: "Tamamlanan", tone: "success" },
  { value: "cancelled", label: "İptal Edilen", tone: "danger" },
];

export function filterOrders(orders: readonly AdminOrderDTO[], tab: OrderTab): AdminOrderDTO[] {
  return orders.filter(MATCHERS[tab]);
}

/** Sekmeler sayaçlarıyla; sayılar seçili sekmeden bağımsız hep görünür */
export function orderTabs(orders: readonly AdminOrderDTO[]): FilterTab<OrderTab>[] {
  return TAB_DEFS.map((tab) => ({ ...tab, count: orders.filter(MATCHERS[tab.value]).length }));
}
