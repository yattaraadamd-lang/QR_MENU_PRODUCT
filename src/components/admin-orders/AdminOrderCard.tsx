import { formatTRY } from "@/lib/format";
import OrderContents from "@/components/orders/OrderContents";
import { ORDER_PAYMENT_STATUS, STOPPED_STATUSES, isFinalStatus, orderStatusMeta } from "@/components/orders/orderStatus";
import type { AdminOrderDTO } from "@/components/orders/types";
import { tableDisplayName } from "@/components/tables/tableModel";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

const DATE_TIME = new Intl.DateTimeFormat("tr-TR", { dateStyle: "short", timeStyle: "short" });

interface AdminOrderCardProps {
  order: AdminOrderDTO;
  onCancel: (order: AdminOrderDTO) => void;
}

/** Admin sipariş kartı: masa, zaman, garson, sipariş ve ödeme durumu, kalemler, iptal */
export default function AdminOrderCard({ order, onCancel }: AdminOrderCardProps) {
  const status = orderStatusMeta(order.status);
  const payment = STOPPED_STATUSES.includes(order.status) ? null : ORDER_PAYMENT_STATUS[order.paymentStatus];
  const name = tableDisplayName(order.table);

  return (
    <li className="card flex flex-col gap-3 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-fg">{name}</h2>
          <p className="mt-0.5 text-xs text-fg-secondary">{DATE_TIME.format(new Date(order.createdAt))}</p>
          {order.waiter && <p className="mt-0.5 text-2xs text-primary-light">👤 {order.waiter.name}</p>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge tone={status.tone}>{status.label}</Badge>
          {payment && <Badge tone={payment.tone}>💰 {payment.label}</Badge>}
        </div>
      </div>

      <OrderContents order={order} />

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-subtle pt-2">
        <span className="text-base font-bold tabular-nums text-primary-light">Toplam: {formatTRY(order.totalPrice)}</span>
        {!isFinalStatus(order.status) && (
          // Ad görünür metinle başlar (WCAG 2.5.3); hangi masa olduğu yalnız ekran okuyucuya
          <Button variant="danger" size="sm" onClick={() => onCancel(order)}>
            <span aria-hidden="true">❌</span> İptal Et<span className="sr-only">: {name} siparişi</span>
          </Button>
        )}
      </div>
    </li>
  );
}
