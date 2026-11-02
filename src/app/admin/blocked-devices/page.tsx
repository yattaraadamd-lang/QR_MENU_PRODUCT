"use client";

import { lazy, Suspense } from "react";
import BlockedDevicesTable from "@/components/blocked-devices/BlockedDevicesTable";
import type { BlockFilter } from "@/components/blocked-devices/types";
import { useBlockedDevicesPage } from "@/components/blocked-devices/useBlockedDevicesPage";
import EmptyState from "@/components/ui/EmptyState";
import FilterTabs, { type FilterTab } from "@/components/ui/FilterTabs";
import Pager from "@/components/ui/Pager";
import QueryError from "@/components/ui/QueryError";
import Skeleton from "@/components/ui/Skeleton";

// Yalnız tıklamayla açılır: ilk yük paketinin dışında (SSR'da hiç çizilmez)
const UnblockDialog = lazy(() => import("@/components/blocked-devices/UnblockDialog"));

const TABS: readonly FilterTab<BlockFilter>[] = [
  { value: "active", label: "🔴 Aktif Engeller" },
  { value: "revoked", label: "✅ Kaldırılmış" },
  { value: "all", label: "📋 Tümü" },
];

const EMPTY_TEXT: Readonly<Record<BlockFilter, string>> = {
  active: "Aktif cihaz engeli bulunmamaktadır.",
  revoked: "Kaldırılmış engel kaydı bulunmamaktadır.",
  all: "Hiç engel kaydı bulunmamaktadır.",
};

const SKELETON_COUNT = 3;

export default function BlockedDevicesPage() {
  const page = useBlockedDevicesPage();
  const { query, blocks, pagination, filter, unblocking } = page;

  return (
    <div>
      <header className="mb-6">
        <h1 className="page-title mb-2">Engelli Cihazlar</h1>
        <p className="text-fg-secondary">İşletmenize ait cihaz engellerini görüntüleyin ve yönetin.</p>
      </header>

      <div className="mb-5">
        <FilterTabs label="Engel durumu" tabs={TABS} value={filter} onChange={page.setFilter} />
      </div>

      <QueryError message={query.error} onRetry={query.refresh} />

      {query.isLoading && (
        <div role="status" aria-label="Cihaz engelleri yükleniyor" className="flex flex-col gap-3">
          {Array.from({ length: SKELETON_COUNT }, (_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      )}

      {!query.isLoading && blocks.length === 0 && !query.error && <EmptyState icon="🔓" title={EMPTY_TEXT[filter]} />}

      {blocks.length > 0 && (
        <>
          <BlockedDevicesTable blocks={blocks} onUnblock={page.openUnblock} />
          {pagination && (
            <Pager
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              onChange={page.setPage}
            />
          )}
        </>
      )}

      <Suspense fallback={null}>
        {unblocking && <UnblockDialog block={unblocking} onClose={page.closeUnblock} onUnblocked={page.handleUnblocked} />}
      </Suspense>
    </div>
  );
}
