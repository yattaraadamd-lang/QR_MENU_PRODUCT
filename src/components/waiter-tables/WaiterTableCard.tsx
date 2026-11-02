import { formatElapsed } from "@/lib/format";
import BillAmounts from "@/components/tables/BillAmounts";
import TableCard from "@/components/tables/TableCard";
import type { TableDTO } from "@/components/tables/types";

interface WaiterTableCardProps {
  table: TableDTO;
  onOpen: (table: TableDTO) => void;
  /** Doluluk süresi için "şimdi" (useNow) */
  now: number;
}

/** Garson masa kartı: doluluk süresi, adisyon, bekleyen talep türleri */
export default function WaiterTableCard({ table, onOpen, now }: WaiterTableCardProps) {
  const { activeSession, bill, serviceRequests } = table;
  const isOccupied = table.status !== "EMPTY";
  const callsWaiter = serviceRequests.some((r) => r.requestType === "CALL_WAITER");
  const asksPayment = serviceRequests.some((r) => r.requestType === "PAYMENT_REQUEST");

  return (
    <TableCard table={table} onOpen={onOpen} density="compact">
      {activeSession && isOccupied && (
        <p className="mb-1 text-2xs text-fg-muted">⏱ {formatElapsed(activeSession.startedAt, now)}</p>
      )}
      {bill && isOccupied && <BillAmounts bill={bill} />}
      {serviceRequests.length > 0 && (
        <p className="mt-1.5 text-2xs font-semibold text-danger-fg">
          🔔 {serviceRequests.length} talep
          {callsWaiter && " · 🙋 Garson"}
          {asksPayment && " · 💳 Ödeme"}
        </p>
      )}
    </TableCard>
  );
}
