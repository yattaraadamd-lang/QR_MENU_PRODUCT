"use client";

import BusinessForm from "@/components/admin-settings/BusinessForm";
import { useAdminSettingsPage } from "@/components/admin-settings/useAdminSettingsPage";
import QueryError from "@/components/ui/QueryError";
import Skeleton from "@/components/ui/Skeleton";

export default function AdminSettingsPage() {
  const { query, business, handleSaved } = useAdminSettingsPage();

  return (
    <div>
      <h1 className="page-title mb-6">İşletme Ayarları</h1>

      {/* Bilgiler gelmeden form çizilmez: boş formu kaydetmek mevcut değerleri ezerdi */}
      <QueryError message={query.error} onRetry={query.refresh} />

      {query.isLoading && (
        <div role="status" aria-label="Ayarlar yükleniyor">
          <Skeleton className="h-[560px] max-w-[600px]" />
        </div>
      )}

      {business && <BusinessForm business={business} onSaved={handleSaved} />}
    </div>
  );
}
