"use client";

import { PLATFORM_SUBSCRIPTIONS_URL, selectSubscriptions } from "@/components/super-admin-platform/platform.api";
import SubscriptionsTable from "@/components/super-admin-platform/SubscriptionsTable";
import { usePlatformQuery } from "@/components/super-admin-platform/usePlatformQuery";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import QueryError from "@/components/ui/QueryError";
import Skeleton from "@/components/ui/Skeleton";

export default function SuperAdminSubscriptionsScreen() {
  const query = usePlatformQuery(PLATFORM_SUBSCRIPTIONS_URL, selectSubscriptions);
  const subscriptions = query.data ?? [];

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Abonelikler</h1>
        {/* Plan ekleme formu henüz yok: tıklanınca alert açmak yerine kapalı */}
        <Button disabled>+ Yeni Plan Ekle (yakında)</Button>
      </header>

      <QueryError message={query.error} onRetry={query.refresh} />

      {query.isLoading && (
        <div role="status" aria-label="Abonelikler yükleniyor">
          <Skeleton className="h-64" />
        </div>
      )}

      {!query.isLoading && subscriptions.length === 0 && !query.error && <EmptyState icon="💎" title="Abonelik kaydı bulunamadı" />}

      {subscriptions.length > 0 && <SubscriptionsTable subscriptions={subscriptions} />}
    </div>
  );
}
