"use client";

import { formatTRY } from "@/lib/format";
import DateRangeFields from "@/components/admin-payments/DateRangeFields";
import { PAYMENT_FILTER_TABS } from "@/components/admin-payments/paymentHistoryModel";
import PaymentsTable from "@/components/admin-payments/PaymentsTable";
import { useAdminPaymentsPage } from "@/components/admin-payments/useAdminPaymentsPage";
import FilterTabs from "@/components/ui/FilterTabs";
import Loader from "@/components/ui/Loader";
import QueryError from "@/components/ui/QueryError";
import StatCard from "@/components/ui/StatCard";

export default function AdminPaymentsPage() {
  const page = useAdminPaymentsPage();
  const { query, summary } = page;

  return (
    <div>
      <h1 className="page-title mb-6">Ödemeler</h1>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <StatCard label="Onay Bekleyen Ödeme Talepleri" value={summary.awaiting} tone="warning" />
        <StatCard label="Bugün Alınan Ciro" value={formatTRY(summary.todayTotal)} tone="success" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterTabs label="Ödeme durumu" tabs={PAYMENT_FILTER_TABS} value={page.filter} onChange={page.setFilter} />
        <DateRangeFields range={page.range} max={page.today} onStart={page.setStart} onEnd={page.setEnd} />
      </div>

      <QueryError message={query.error} onRetry={query.refresh} />
      {query.isLoading ? <Loader label="Ödemeler yükleniyor" /> : <PaymentsTable payments={page.visible} />}
    </div>
  );
}
