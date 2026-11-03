import Link from "next/link";
import { ArrowRight, ClipboardList } from "lucide-react";
import { formatClock, formatTRY } from "@/lib/format";
import { orderStatusLabel } from "@/components/orders/orderStatusLabel";
import { tableDisplayName } from "@/components/tables/tableName";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import SectionCard from "@/components/ui/SectionCard";
import type { RecentOrderDTO } from "./types";

/** Son 5 sipariş: masa, kalem sayısı, tutar, saat, durum */
export default function RecentOrders({ orders }: { orders: readonly RecentOrderDTO[] }) {
  return (
    <SectionCard
      title="Son Siparişler"
      className="overflow-hidden"
      action={
        <Link
          href="/admin/orders"
          className="flex shrink-0 items-center gap-1 text-xs font-semibold text-primary-light hover:underline"
        >
          Tümünü Gör
          <span className="sr-only"> (siparişler)</span>
          <ArrowRight aria-hidden="true" className="size-3" />
        </Link>
      }
    >
      {orders.length === 0 ? (
        <EmptyState
          variant="plain"
          icon={<ClipboardList className="mx-auto size-9 text-fg-muted" strokeWidth={1.5} />}
          title="Henüz sipariş yok"
        />
      ) : (
        <ul>
          {orders.map((order) => {
            const status = orderStatusLabel(order.status);
            return (
              <li
                key={order.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-line-subtle px-5 py-3.5 last:border-b-0"
              >
                <div className="min-w-[180px] flex-1">
                  <p className="mb-[3px] text-sm font-semibold text-fg">{tableDisplayName(order.table)}</p>
                  <p className="text-xs text-fg-secondary">
                    {order.items.length} ürün · {formatTRY(order.totalPrice)} ·{" "}
                    <time dateTime={order.createdAt}>{formatClock(order.createdAt)}</time>
                  </p>
                </div>
                <Badge tone={status.tone}>{status.label}</Badge>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
