"use client";

import { lazy, Suspense } from "react";
import { ClipboardList } from "lucide-react";
import { useNow } from "@/hooks/useNow";
import OrderCard from "@/components/waiter-orders/OrderCard";
import OrderFilterTabs from "@/components/waiter-orders/OrderFilterTabs";
import { stopStatusFor } from "@/components/waiter-orders/orderModel";
import { useWaiterOrdersPage } from "@/components/waiter-orders/useWaiterOrdersPage";
import EmptyState from "@/components/ui/EmptyState";
import QueryError from "@/components/ui/QueryError";
import Skeleton from "@/components/ui/Skeleton";

// Yalnız tıklamayla açılır: ilk yük paketinin dışında (SSR'da hiç çizilmez)
const StopOrderDialog = lazy(() => import("@/components/waiter-orders/StopOrderDialog"));

const SKELETON_COUNT = 3;
/** "40sn önce" gibi göreli zamanlar bu aralıkla tazelenir */
const CLOCK_TICK_MS = 15_000;

export default function WaiterOrdersPage() {
  const page = useWaiterOrdersPage();
  const { query, orders, filter, pendingCount, stopping } = page;
  const now = useNow(CLOCK_TICK_MS);
  const stopTarget = stopping ? stopStatusFor(stopping.status) : null;

  return (
    <div>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h1 className="page-title page-title-sm">Siparişler</h1>
          {pendingCount > 0 && filter === "active" && (
            <span className="animate-pulse-glow rounded-full bg-danger px-2 py-0.5 text-2xs font-extrabold text-white">
              {pendingCount} yeni
            </span>
          )}
        </div>
        <OrderFilterTabs value={filter} onChange={page.setFilter} pendingCount={pendingCount} />
      </header>

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
          <StopOrderDialog order={stopping} target={stopTarget} onClose={page.closeStop} onDone={page.handleStopped} />
        )}
      </Suspense>
    </div>
  );
}
