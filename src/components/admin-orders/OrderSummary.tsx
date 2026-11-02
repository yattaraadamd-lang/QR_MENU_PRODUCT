import { formatTRY } from "@/lib/format";
import { orderStatusMeta } from "@/components/orders/orderStatus";
import type { OrderDTO } from "@/components/orders/types";
import { tableDisplayName } from "@/components/tables/tableModel";

/** İptal penceresinin üstünde: hangi masa, ne tutar, hangi durumda */
export default function OrderSummary({ order }: { order: OrderDTO }) {
  const rows = [
    { label: "Masa", value: tableDisplayName(order.table) },
    { label: "Toplam", value: formatTRY(order.totalPrice) },
    { label: "Durum", value: orderStatusMeta(order.status).label },
  ];

  return (
    <dl className="flex flex-col gap-1 rounded-md bg-surface-hover p-3 text-sm">
      {rows.map((row) => (
        <div key={row.label} className="flex justify-between gap-2">
          <dt className="text-fg-secondary">{row.label}</dt>
          <dd className="font-semibold text-fg">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
