"use client";

import { Eye, EyeOff } from "lucide-react";
import { dashboardKpis } from "@/components/admin-dashboard/dashboardModel";
import KpiGrid from "@/components/admin-dashboard/KpiGrid";
import QuickLinks from "@/components/admin-dashboard/QuickLinks";
import RecentOrders from "@/components/admin-dashboard/RecentOrders";
import { useDashboardPage } from "@/components/admin-dashboard/useDashboardPage";
import Button from "@/components/ui/Button";
import QueryError from "@/components/ui/QueryError";
import Skeleton from "@/components/ui/Skeleton";

const KPI_SKELETONS = 7;

export default function AdminDashboardScreen() {
  const page = useDashboardPage();
  const { query, summary, revenueHidden } = page;

  return (
    <div>
      <header className="mb-7 flex flex-wrap items-start justify-between gap-3.5">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="mt-1 text-sm text-fg-secondary">Hoş geldiniz, {page.userName}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={revenueHidden ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
          onClick={page.toggleRevenue}
        >
          {revenueHidden ? "Ciroyu Göster" : "Ciroyu Gizle"}
        </Button>
      </header>

      {/* Hata eski sayıların yerine 0 göstermesin: özet yoksa kartlar hiç çizilmez */}
      <QueryError message={query.error} onRetry={query.refresh} />

      {query.isLoading && (
        <div role="status" aria-label="Panel hazırlanıyor">
          <div className="mb-8 grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3.5">
            {Array.from({ length: KPI_SKELETONS }, (_, i) => (
              <Skeleton key={i} className="h-[118px]" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </div>
      )}

      {summary && (
        <>
          <KpiGrid kpis={dashboardKpis(summary)} revenueHidden={revenueHidden} />
          <div className="grid items-start gap-5 lg:grid-cols-[1fr_auto]">
            <RecentOrders orders={summary.recentOrders} />
            <QuickLinks />
          </div>
        </>
      )}
    </div>
  );
}
