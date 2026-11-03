/** Admin dashboard sözleşmesi. Kaynak: /api/admin/dashboard/summary → `{ success, data }` */

import type { OrderDTO } from "@/components/orders/types";

/** Son 5 sipariş: kalemlerden yalnız sayı için id gelir */
export interface RecentOrderDTO extends Pick<OrderDTO, "id" | "table" | "totalPrice" | "status" | "createdAt"> {
  readonly items: readonly { readonly id: string }[];
}

export interface DashboardSummaryDTO {
  readonly todayRevenue: number;
  readonly monthlyRevenue: number;
  readonly todayOrderCount: number;
  readonly totalOrderCount: number;
  readonly pendingOrderCount: number;
  readonly activeRequestCount: number;
  readonly paymentRequestCount: number;
  readonly occupiedTableCount: number;
  readonly totalTableCount: number;
  readonly recentOrders: readonly RecentOrderDTO[];
}
