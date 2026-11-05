"use client";

import { useApiQuery } from "@/hooks/useApiQuery";
import { formatDateTime } from "@/lib/format";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Modal from "@/components/ui/Modal";
import QueryError from "@/components/ui/QueryError";
import Skeleton from "@/components/ui/Skeleton";
import { tableDisplayName, tableStatusMeta } from "@/components/tables/tableModel";
import type { TableDTO } from "@/components/tables/types";
import type { TableEventDTO } from "./adminTables.api";
import { tableEventActor, tableEventLabel } from "./tableEventModel";

const selectEvents = (json: unknown) => (json as { events?: TableEventDTO[] } | null)?.events ?? [];

/** Masanın son durum değişiklikleri: kim, neden, ne zaman */
export default function TableHistoryDialog({ table, onClose }: { table: TableDTO; onClose: () => void }) {
  const query = useApiQuery(`/api/admin/tables/${encodeURIComponent(table.id)}/events`, { select: selectEvents });
  const events = query.data ?? [];

  return (
    <Modal
      onClose={onClose}
      title={`${tableDisplayName(table)} geçmişi`}
      description="Son durum değişiklikleri"
      footer={
        <Button variant="ghost" className="flex-1" onClick={onClose}>
          Kapat
        </Button>
      }
    >
      <QueryError message={query.error} onRetry={query.refresh} />
      {query.isLoading && <Skeleton className="h-24" />}
      {!query.isLoading && events.length === 0 && !query.error && (
        <EmptyState icon="🕘" title="Henüz kayıt yok" description="Masanın durumu değiştiğinde burada görünür." />
      )}
      {events.length > 0 && (
        <ol className="divide-y divide-line-subtle text-xs">
          {events.map((event) => (
            <li key={event.id} className="py-2">
              <p className="font-semibold text-fg">{tableEventLabel(event.reason)}</p>
              <p className="text-fg-secondary">
                {tableStatusMeta(event.fromStatus).label} → {tableStatusMeta(event.toStatus).label}
              </p>
              <p className="text-2xs text-fg-secondary">
                {tableEventActor(event)} · <time dateTime={event.createdAt}>{formatDateTime(event.createdAt)}</time>
              </p>
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}
