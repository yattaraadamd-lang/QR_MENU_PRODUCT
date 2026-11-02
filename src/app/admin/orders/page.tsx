"use client";

import { lazy, Suspense } from "react";
import AdminOrderCard from "@/components/admin-orders/AdminOrderCard";
import { adminOrdersApi } from "@/components/admin-orders/adminOrders.api";
import type { OrderTab } from "@/components/admin-orders/orderTabs";
import OrderSummary from "@/components/admin-orders/OrderSummary";
import { useAdminOrdersPage } from "@/components/admin-orders/useAdminOrdersPage";
import Alert from "@/components/ui/Alert";
import EmptyState from "@/components/ui/EmptyState";
import FilterTabs from "@/components/ui/FilterTabs";
import QueryError from "@/components/ui/QueryError";
import Skeleton from "@/components/ui/Skeleton";

// Yalnız tıklamayla açılır: ilk yük paketinin dışında (SSR'da hiç çizilmez)
const CancelOrderDialog = lazy(() => import("@/components/orders/CancelOrderDialog"));

const SKELETON_COUNT = 3;

export default function AdminOrdersPage() {
  const page = useAdminOrdersPage();
  const { query, tab, visible, cancelling } = page;

  return (
    <div>
      <header className="mb-6">
        <h1 className="page-title">Sipariş Yönetimi</h1>
        <p className="mt-1 text-sm text-fg-secondary">{page.total} sipariş</p>
      </header>

      <div className="mb-5">
        <FilterTabs<OrderTab> label="Sipariş durumu" tabs={page.tabs} value={tab} onChange={page.setTab} />
      </div>

      {tab === "pending_payment" && visible.length > 0 && (
        <Alert tone="purple" className="mb-4">
          💳 Bu siparişler servis edilmiş ancak henüz ödeme alınmamış. Ödeme almak için admin/kasa panelinden işlem yapın.
        </Alert>
      )}

      <QueryError message={query.error} onRetry={query.refresh} />

      {query.isLoading && (
        <div role="status" aria-label="Siparişler yükleniyor" className="flex flex-col gap-2">
          {Array.from({ length: SKELETON_COUNT }, (_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      )}

      {!query.isLoading && visible.length === 0 && !query.error && (
        <EmptyState icon="📋" title="Bu kategoride sipariş bulunamadı" />
      )}

      {visible.length > 0 && (
        <ul aria-label="Siparişler" className="stagger flex flex-col gap-2.5">
          {visible.map((order) => (
            <AdminOrderCard key={order.id} order={order} onCancel={page.openCancel} />
          ))}
        </ul>
      )}

      <Suspense fallback={null}>
        {cancelling && (
          <CancelOrderDialog
            order={cancelling}
            title="Siparişi İptal Et"
            action={adminOrdersApi.cancel}
            summary={<OrderSummary order={cancelling} />}
            onClose={page.closeCancel}
            onDone={page.handleCancelled}
          />
        )}
      </Suspense>
    </div>
  );
}
