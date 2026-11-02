import { Clock, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatTimeAgo, formatTRY } from "@/lib/format";
import OrderContents from "@/components/orders/OrderContents";
import { orderStatusMeta } from "@/components/orders/orderStatus";
import type { OrderDTO } from "@/components/orders/types";
import { tableDisplayName } from "@/components/tables/tableModel";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import ToneStripe from "@/components/ui/ToneStripe";
import { nextOrderStep, stopStatusFor, type OrderStep } from "./orderModel";

interface OrderCardProps {
  order: OrderDTO;
  /** Göreli zaman için "şimdi" (useNow) */
  now: number;
  busy: boolean;
  onAdvance: (order: OrderDTO, step: OrderStep) => void;
  onStop: (order: OrderDTO) => void;
}

/** Sipariş kartı: masa, durum, kalemler, notlar ve sıradaki adım (kabul → hazırla → servis) */
export default function OrderCard({ order, now, busy, onAdvance, onStop }: OrderCardProps) {
  const status = orderStatusMeta(order.status);
  const step = nextOrderStep(order.status);
  const stop = stopStatusFor(order.status);
  const name = tableDisplayName(order.table);

  return (
    <li className={cn("card relative overflow-hidden transition-opacity", busy && "opacity-70")} aria-busy={busy || undefined}>
      {order.status === "PENDING" && <ToneStripe tone={status.tone} />}

      <div className="flex items-start justify-between gap-3 border-b border-line-subtle px-4 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-bold text-fg">{name}</h2>
            <Badge tone={status.tone}>
              <status.Icon aria-hidden="true" className="size-3.5" />
              {status.label}
            </Badge>
          </div>
          <p className="mt-1 flex items-center gap-1 text-2xs text-fg-secondary">
            <Clock aria-hidden="true" className="size-3" />
            {formatTimeAgo(order.createdAt, now)}
            {order.waiter && ` · ${order.waiter.name}`}
          </p>
        </div>
        <span className="shrink-0 text-base font-extrabold tabular-nums text-primary-light">
          {formatTRY(order.totalPrice)}
        </span>
      </div>

      <div className="px-4 py-2.5">
        <OrderContents order={order} />
      </div>

      {step && (
        <div className="flex gap-2 border-t border-line-subtle px-4 py-2.5">
          <Button
            variant={step.variant}
            size="sm"
            className="flex-1"
            loading={busy}
            leftIcon={<step.Icon className="size-3.5" />}
            onClick={() => onAdvance(order, step)}
          >
            {step.label}
          </Button>
          {stop === "REJECTED" && (
            <Button variant="danger" size="sm" className="flex-1" disabled={busy} leftIcon={<X className="size-3.5" />} onClick={() => onStop(order)}>
              Reddet
            </Button>
          )}
          {stop === "CANCELLED" && (
            <Button
              variant="danger-ghost"
              size="sm"
              disabled={busy}
              aria-label={`${name} siparişini iptal et`}
              onClick={() => onStop(order)}
            >
              <X aria-hidden="true" className="size-3.5" />
            </Button>
          )}
        </div>
      )}
    </li>
  );
}
