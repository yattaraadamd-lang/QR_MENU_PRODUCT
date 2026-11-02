"use client";

import { useNow } from "@/hooks/useNow";
import StaffQueueHeader from "@/components/staff/StaffQueueHeader";
import RequestCard from "@/components/waiter-requests/RequestCard";
import { useWaiterRequestsPage } from "@/components/waiter-requests/useWaiterRequestsPage";
import EmptyState from "@/components/ui/EmptyState";
import QueryError from "@/components/ui/QueryError";
import Skeleton from "@/components/ui/Skeleton";

const SKELETON_COUNT = 3;
/** "40sn önce" ve "süresi doldu" bu aralıkla tazelenir */
const CLOCK_TICK_MS = 15_000;

export default function WaiterRequestsPage() {
  const page = useWaiterRequestsPage();
  const { query, requests, filter } = page;
  const now = useNow(CLOCK_TICK_MS);

  return (
    <div>
      <StaffQueueHeader
        title="Talepler"
        filterLabel="Talep filtresi"
        filter={filter}
        onFilterChange={page.setFilter}
        pendingCount={page.pendingCount}
      />

      <QueryError message={query.error} onRetry={query.refresh} />

      {query.isLoading && (
        <div role="status" aria-label="Talepler yükleniyor" className="flex flex-col gap-2.5">
          {Array.from({ length: SKELETON_COUNT }, (_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      )}

      {!query.isLoading && requests.length === 0 && !query.error && (
        <EmptyState icon="✅" title={filter === "active" ? "Bekleyen talep yok" : "Geçmiş talep yok"} />
      )}

      {requests.length > 0 && (
        <ul aria-label="Talepler" className="stagger flex flex-col gap-2.5">
          {requests.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              now={now}
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
