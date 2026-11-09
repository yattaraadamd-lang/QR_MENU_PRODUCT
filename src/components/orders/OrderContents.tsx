import { formatTRY } from "@/lib/format";
import Alert from "@/components/ui/Alert";
import type { OrderDTO } from "./types";

/** Sipariş kalemleri + sipariş notu + iptal/red nedeni (garson ve admin kartı ortak) */
export default function OrderContents({ order }: { order: OrderDTO }) {
  return (
    <div className="flex flex-col gap-2">
      <ul className="divide-y divide-line-subtle text-sm">
        {order.items.map((item) => (
          <li key={item.id} className="flex justify-between gap-2 py-1">
            <span className="min-w-0 text-fg-secondary">
              <span className="font-semibold text-fg">{item.quantity}×</span> {item.productName}
              {item.customerNote && <span className="block text-2xs text-warning-fg">📝 {item.customerNote}</span>}
            </span>
            <span className="shrink-0 font-semibold tabular-nums text-fg-secondary">{formatTRY(item.totalPrice)}</span>
          </li>
        ))}
      </ul>
      {order.note && (
        <Alert tone="warning" size="sm">
          <strong>Sipariş Notu:</strong> {order.note}
        </Alert>
      )}
      {order.cancelReason && (
        <Alert tone="danger" size="sm">
          <strong>{order.status === "REJECTED" ? "Red Nedeni:" : "İptal Nedeni:"}</strong> {order.cancelReason}
        </Alert>
      )}
    </div>
  );
}
