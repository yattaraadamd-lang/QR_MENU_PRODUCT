"use client";

import AdminRequestCard from "@/components/admin-requests/AdminRequestCard";
import type { RequestTab } from "@/components/admin-requests/requestTabs";
import { useAdminRequestsPage } from "@/components/admin-requests/useAdminRequestsPage";
import EmptyState from "@/components/ui/EmptyState";
import FilterTabs from "@/components/ui/FilterTabs";
import QueryError from "@/components/ui/QueryError";
import Skeleton from "@/components/ui/Skeleton";

const SKELETON_COUNT = 3;

export default function AdminRequestsScreen() {
  const page = useAdminRequestsPage();
  const { query, tab, visible } = page;

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Müşteri Talepleri</h1>
        <FilterTabs<RequestTab> label="Talep durumu" tabs={page.tabs} value={tab} onChange={page.setTab} />
      </header>

      <QueryError message={query.error} onRetry={query.refresh} />

      {query.isLoading && (
        <div role="status" aria-label="Talepler yükleniyor" className="flex flex-col gap-2">
          {Array.from({ length: SKELETON_COUNT }, (_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      )}

      {!query.isLoading && visible.length === 0 && !query.error && <EmptyState icon="🔔" title="Talep bulunamadı" />}

      {visible.length > 0 && (
        <ul aria-label="Talepler" className="stagger flex flex-col gap-2">
          {visible.map((request) => (
            <AdminRequestCard
              key={request.id}
              request={request}
              busy={page.busyId === request.id}
              onStatus={page.updateStatus}
              onOpenTable={page.openTable}
              onRejectOrder={page.rejectOrderRequest}
            />
          ))}
        </ul>
      )}

      {page.confirmDialog}
    </div>
  );
}
