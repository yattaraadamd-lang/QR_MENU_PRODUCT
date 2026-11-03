import { formatDateTime, formatTRY } from "@/lib/format";
import { paymentMethodLabel } from "@/components/payments/paymentMethods";
import { tableDisplayName } from "@/components/tables/tableModel";
import Badge from "@/components/ui/Badge";
import ScrollRegion from "@/components/ui/ScrollRegion";
import { paymentStatusMeta } from "./paymentHistoryModel";
import type { PaymentRecordDTO } from "./types";

const COLUMNS = ["Masa", "Tutar", "Alınan / Para Üstü", "Durum", "Yöntem", "Talep Eden Garson", "Onaylayan Admin", "Tarih", "Not"];

/** Ödeme kayıtları tablosu; dar ekranda yatay kayar (klavyeyle de) */
export default function PaymentsTable({ payments }: { payments: readonly PaymentRecordDTO[] }) {
  return (
    <ScrollRegion label="Ödemeler tablosu" className="card">
      <table className="table min-w-[56rem]">
        <thead>
          <tr>
            {COLUMNS.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {payments.map((p) => {
            const status = paymentStatusMeta(p.status);
            const waiter = p.requestedByName || p.handledByWaiterName;
            return (
              <tr key={p.id}>
                <td className="font-semibold text-fg">{p.table ? tableDisplayName(p.table) : "-"}</td>
                <td className="font-bold tabular-nums text-primary-light">{formatTRY(p.amount)}</td>
                <td className="text-sm tabular-nums">
                  {p.method === "CASH" && p.receivedAmount ? (
                    <>
                      Alınan: {formatTRY(p.receivedAmount)}
                      {Number(p.changeAmount) > 0 && (
                        <span className="block text-success-fg">Üstü: {formatTRY(p.changeAmount)}</span>
                      )}
                    </>
                  ) : (
                    "-"
                  )}
                </td>
                <td>
                  <Badge tone={status.tone}>{status.label}</Badge>
                </td>
                <td>{p.method ? paymentMethodLabel(p.method) : "-"}</td>
                <td className="text-sm">{waiter ? <span className="font-semibold text-primary-light">👤 {waiter}</span> : "-"}</td>
                <td className="text-sm">
                  {p.approvedByName ? <span className="font-semibold text-success-fg">🛡️ {p.approvedByName}</span> : "-"}
                </td>
                <td className="whitespace-nowrap">{formatDateTime(p.paidAt ?? p.createdAt)}</td>
                <td className="text-xs text-fg-secondary">{p.note || (p.rejectionReason ? `Red: ${p.rejectionReason}` : "-")}</td>
              </tr>
            );
          })}
          {payments.length === 0 && (
            <tr>
              <td colSpan={COLUMNS.length} className="p-8 text-center text-fg-secondary">
                Ödeme kaydı bulunamadı.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </ScrollRegion>
  );
}
