"use client";

import { lazy, Suspense } from "react";
import BusinessesTable from "@/components/super-admin-businesses/BusinessesTable";
import { useBusinessesPage } from "@/components/super-admin-businesses/useBusinessesPage";
import Button from "@/components/ui/Button";
import Loader from "@/components/ui/Loader";
import QueryError from "@/components/ui/QueryError";

// Yalnız tıklamayla açılır: ilk yük paketinin dışında (SSR'da hiç çizilmez)
const CreateBusinessDialog = lazy(() => import("@/components/super-admin-businesses/CreateBusinessDialog"));

export default function SuperAdminBusinessesScreen() {
  const page = useBusinessesPage();
  const { query } = page;

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">İşletme Yönetimi</h1>
        <Button onClick={page.openCreate}>+ Yeni İşletme Ekle</Button>
      </header>

      <QueryError message={query.error} onRetry={query.refresh} />
      {query.isLoading ? (
        <Loader label="İşletmeler yükleniyor" />
      ) : (
        <BusinessesTable businesses={page.businesses} busyId={page.busyId} onToggle={page.toggleActive} />
      )}

      <Suspense fallback={null}>
        {page.creating && <CreateBusinessDialog onClose={page.closeCreate} onCreated={page.handleCreated} />}
      </Suspense>
      {page.confirmDialog}
    </div>
  );
}
