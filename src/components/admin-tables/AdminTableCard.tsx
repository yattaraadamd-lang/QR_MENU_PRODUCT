import BillAmounts from "@/components/tables/BillAmounts";
import TableCard from "@/components/tables/TableCard";
import { tableDisplayName } from "@/components/tables/tableModel";
import type { TableDTO } from "@/components/tables/types";
import Button from "@/components/ui/Button";

interface AdminTableCardProps {
  table: TableDTO;
  onOpen: (table: TableDTO) => void;
  onShowQr: (table: TableDTO) => void;
  onDelete: (table: TableDTO) => void;
  qrPending: boolean;
}

/** Admin masa kartı: adisyon özeti, açık sipariş/talep sayısı, QR ve silme */
export default function AdminTableCard({ table, onOpen, onShowQr, onDelete, qrPending }: AdminTableCardProps) {
  const name = tableDisplayName(table);
  const { bill, orders, serviceRequests } = table;

  return (
    <TableCard
      table={table}
      onOpen={onOpen}
      actions={
        <>
          <Button variant="ghost" size="sm" className="flex-1" loading={qrPending} onClick={() => onShowQr(table)}>
            📱 QR
          </Button>
          <Button variant="ghost" size="sm" aria-label={`${name} sil`} onClick={() => onDelete(table)}>
            🗑️
          </Button>
        </>
      }
    >
      {bill && table.status !== "EMPTY" && (
        <BillAmounts bill={bill} className="mb-2 rounded-sm bg-surface-hover px-2 py-1.5" />
      )}
      {(orders.length > 0 || serviceRequests.length > 0) && (
        <p className="flex gap-2 text-2xs">
          {orders.length > 0 && <span className="text-warning-fg">🧾 {orders.length} sipariş</span>}
          {serviceRequests.length > 0 && <span className="text-danger-fg">🔔 {serviceRequests.length} talep</span>}
        </p>
      )}
    </TableCard>
  );
}
