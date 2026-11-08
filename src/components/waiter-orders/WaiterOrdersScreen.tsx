"use client";

import { lazy, Suspense } from "react";
import { ClipboardList } from "lucide-react";
import { useNow } from "@/hooks/useNow";
import OrderCard from "@/components/waiter-orders/OrderCard";
import { useWaiterOrdersPage } from "@/components/waiter-orders/useWaiterOrdersPage";
import { waiterOrdersApi } from "@/components/waiter-orders/waiterOrders.api";
import StaffQueueHeader from "@/components/staff/StaffQueueHeader";
import EmptyState from "@/components/ui/EmptyState";
import QueryError from "@/components/ui/QueryError";
import Skeleton from "@/components/ui/Skeleton";

// Yalnız tıklamayla açılır: ilk yük paketinin dışında (SSR'da hiç çizilmez)
const CancelOrderDialog = lazy(() => import("@/components/orders/CancelOrderDialog"));

const SKELETON_COUNT = 3;
/** "40sn önce" gibi göreli zamanlar bu aralıkla tazelenir */
const CLOCK_TICK_MS = 15_000;

export default function WaiterOrdersScreen() {
  const page = useWaiterOrdersPage();
  const { query, orders, filter, pendingCount, stopping, stopTarget } = page;
  const now = useNow(CLOCK_TICK_MS);
  const isReject = stopTarget === "REJECTED";

  return (
    <div>
      <StaffQueueHeader
        title="Siparişler"
        filterLabel="Sipariş filtresi"
        filter={filter}
        onFilterChange={page.setFilter}
        pendingCount={pendingCount}
      />

      <QueryError message={query.error} onRetry={query.refresh} />

      {query.isLoading && (
        <div role="status" aria-label="Siparişler yükleniyor" className="flex flex-col gap-2.5">
          {Array.from({ length: SKELETON_COUNT }, (_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      )}

      {!query.isLoading && orders.length === 0 && !query.error && (
        <EmptyState
          icon={<ClipboardList className="mx-auto size-12 text-fg-muted" strokeWidth={1.5} />}
          title={filter === "active" ? "Bekleyen sipariş yok" : "Geçmiş sipariş yok"}
        />
      )}

      {orders.length > 0 && (
        <ul aria-label="Siparişler" className="stagger flex flex-col gap-2.5">
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              now={now}
              busy={page.busyId === order.id}
              onAdvance={page.advance}
              onStop={page.openStop}
            />
          ))}
        </ul>
      )}

      <Suspense fallback={null}>
        {stopping && stopTarget && (
          <CancelOrderDialog
            order={stopping}
            title={isReject ? "Siparişi Reddet" : "Siparişi İptal Et"}
            action={isReject ? waiterOrdersApi.reject : waiterOrdersApi.cancel}
            onClose={page.closeStop}
            onDone={page.handleStopped}
          />
        )}
      </Suspense>
    </div>
  );
}
