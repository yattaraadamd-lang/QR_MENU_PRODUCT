"use client";

import { useSession } from "next-auth/react";
import { useApiQuery } from "@/hooks/useApiQuery";
import { useBusinessSocket } from "@/hooks/useBusinessSocket";
import { useNow } from "@/hooks/useNow";
import { TableGrid, TableGridSkeleton } from "@/components/tables/TableGrid";
import TableDetailFlow from "@/components/tables/TableDetailFlow";
import { selectTables } from "@/components/tables/tables.api";
import { useTableDetail } from "@/components/tables/useTableDetail";
import WaiterTableCard from "@/components/waiter-tables/WaiterTableCard";
import EmptyState from "@/components/ui/EmptyState";
import QueryError from "@/components/ui/QueryError";

/** Sekme görünürken yenileme aralığı; değişiklikler ayrıca soketle anında gelir */
const REFRESH_MS = 5000;
/** Doluluk süresi dakika hassasiyetinde */
const CLOCK_TICK_MS = 30_000;
const TABLE_EVENTS = ["table_status_update", "table_opened", "request_status_update", "payment_collected"];

export default function WaiterTablesScreen() {
  const { data: session } = useSession();
  // Oturum gelmeden istek atılmaz; sekme gizliyken polling durur
  const query = useApiQuery(session?.user.businessId ? "/api/waiter/tables" : null, {
    select: selectTables,
    refreshInterval: REFRESH_MS,
  });
  const tables = query.data ?? [];
  useBusinessSocket(TABLE_EVENTS, query.refresh);

  const detail = useTableDetail(tables);
  const now = useNow(CLOCK_TICK_MS);

  return (
    <div>
      <h1 className="page-title page-title-sm mb-4">Masa Durumları</h1>

      <QueryError message={query.error} onRetry={query.refresh} />

      {query.isLoading && <TableGridSkeleton density="compact" />}

      {!query.isLoading && tables.length === 0 && !query.error && (
        <EmptyState icon="🪑" title="Henüz masa yok" description="Masalar işletme yöneticisi tarafından eklenir." />
      )}

      {tables.length > 0 && (
        <TableGrid density="compact" label="Masalar">
          {tables.map((table) => (
            <WaiterTableCard key={table.id} table={table} onOpen={detail.open} now={now} />
          ))}
        </TableGrid>
      )}

      <TableDetailFlow detail={detail} allowForceClose={false} onTablesChanged={query.refresh} />
    </div>
  );
}
