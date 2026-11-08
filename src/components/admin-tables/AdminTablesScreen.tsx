"use client";

import { lazy, Suspense } from "react";
import AdminTableCard from "@/components/admin-tables/AdminTableCard";
import { useAdminTablesPage } from "@/components/admin-tables/useAdminTablesPage";
import { TableGrid, TableGridSkeleton } from "@/components/tables/TableGrid";
import TableDetailFlow from "@/components/tables/TableDetailFlow";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import QueryError from "@/components/ui/QueryError";

// Yalnız tıklamayla açılan pencereler: ilk yük paketinin dışında (SSR'da hiç çizilmez)
const CreateTableDialog = lazy(() => import("@/components/admin-tables/CreateTableDialog"));
const TableQrDialog = lazy(() => import("@/components/admin-tables/TableQrDialog"));
const DeleteTableDialog = lazy(() => import("@/components/admin-tables/DeleteTableDialog"));
const TableHistoryDialog = lazy(() => import("@/components/admin-tables/TableHistoryDialog"));

export default function AdminTablesScreen() {
  const page = useAdminTablesPage();
  const { query, tables, stats, dialog } = page;

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Masa & QR Yönetimi</h1>
          <p className="mt-1 text-sm text-fg-secondary">
            {stats.total} masa · {stats.occupied} dolu · {stats.empty} boş
            {stats.pendingPayment > 0 && (
              <span className="ml-2 text-purple-fg">· {stats.pendingPayment} bekleyen ödeme</span>
            )}
          </p>
        </div>
        <Button onClick={page.openCreate}>+ Yeni Masa</Button>
      </header>

      {stats.pendingPayment > 0 && (
        <Alert tone="purple" className="mb-4">
          💳 <strong>{stats.pendingPayment} masada</strong> bekleyen ödeme var. Ödeme almak için masa kartına tıklayın.
        </Alert>
      )}

      <QueryError message={query.error} onRetry={query.refresh} />

      {query.isLoading && <TableGridSkeleton density="comfortable" />}

      {!query.isLoading && tables.length === 0 && !query.error && (
        <EmptyState
          icon="🪑"
          title="Henüz masa eklenmemiş"
          description="Masa ekleyin, her masa için QR kodu üretip masaya yerleştirin."
          action={<Button onClick={page.openCreate}>İlk Masayı Ekle</Button>}
        />
      )}

      {tables.length > 0 && (
        <TableGrid density="comfortable" label="Masalar">
          {tables.map((table) => (
            <AdminTableCard
              key={table.id}
              table={table}
              onOpen={page.detail.open}
              onShowQr={page.showQr}
              onDelete={page.openDelete}
              onHistory={page.openHistory}
              qrPending={page.qrPendingId === table.id}
            />
          ))}
        </TableGrid>
      )}

      <TableDetailFlow detail={page.detail} allowForceClose onTablesChanged={query.refresh} />

      <Suspense fallback={null}>
        {dialog.kind === "create" && <CreateTableDialog onClose={page.closeDialog} onCreated={page.afterMutation} />}
        {dialog.kind === "qr" && <TableQrDialog qr={dialog.qr} onClose={page.closeDialog} />}
        {dialog.kind === "delete" && (
          <DeleteTableDialog table={dialog.table} onClose={page.closeDialog} onDeleted={page.afterMutation} />
        )}
        {dialog.kind === "history" && <TableHistoryDialog table={dialog.table} onClose={page.closeDialog} />}
      </Suspense>
    </div>
  );
}
