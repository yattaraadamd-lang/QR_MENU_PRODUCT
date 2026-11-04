"use client";

import { PLATFORM_STATS_URL, selectStats } from "@/components/super-admin-platform/platform.api";
import { platformStats } from "@/components/super-admin-platform/platformModel";
import { usePlatformQuery } from "@/components/super-admin-platform/usePlatformQuery";
import QueryError from "@/components/ui/QueryError";
import Skeleton from "@/components/ui/Skeleton";
import StatCard from "@/components/ui/StatCard";

const GRID = "grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4";
const SKELETON_COUNT = 6;

export default function SuperAdminDashboardPage() {
  const query = usePlatformQuery(PLATFORM_STATS_URL, selectStats);

  return (
    <div>
      <h1 className="page-title mb-6">Platform Özeti</h1>

      {/* Hata sıfır gibi görünmesin: özet yoksa kartlar hiç çizilmez */}
      <QueryError message={query.error} onRetry={query.refresh} />

      {query.isLoading && (
        <div role="status" aria-label="Özet yükleniyor" className={GRID}>
          {Array.from({ length: SKELETON_COUNT }, (_, i) => (
            <Skeleton key={i} className="h-[92px]" />
          ))}
        </div>
      )}

      {query.data && (
        <div className={`stagger ${GRID}`}>
          {platformStats(query.data).map((stat) => (
            <StatCard key={stat.label} label={stat.label} value={stat.value} tone={stat.tone} icon={stat.icon} />
          ))}
        </div>
      )}
    </div>
  );
}
