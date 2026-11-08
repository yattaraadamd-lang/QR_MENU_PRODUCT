import { cn } from "@/lib/cn";
import { formatTimeAgo } from "@/lib/format";
import { tableDisplayName } from "@/components/tables/tableModel";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import ToneStripe from "@/components/ui/ToneStripe";
import { TONE_TINT } from "@/components/ui/tone";
import OrderPreview from "@/components/requests/OrderPreview";
import { OrderRequestActions } from "./OrderRequestPanel";
import { isExpired, isOpenRequest, nextRequestStep, requestStatusMeta, requestTypeMeta } from "@/components/requests/requestModel";
import type { RequestStatus, ServiceRequestDTO } from "@/components/requests/types";

interface RequestCardProps {
  request: ServiceRequestDTO;
  now: number;
  /** Bu masada bekleyen sipariş talebi sayısı: birden fazlaysa garson uyarılır */
  tableOrderRequests: number;
  busy: boolean;
  onStatus: (request: ServiceRequestDTO, status: RequestStatus) => void;
  onOpenTable: (request: ServiceRequestDTO, code: string) => Promise<boolean>;
  onRejectOrder: (request: ServiceRequestDTO) => void;
}

/** Talep kartı: tür, masa, zaman, durum; sipariş talebinde kodla masa açma, diğerlerinde işleme al/tamamla/iptal */
export default function RequestCard({ request, now, tableOrderRequests, busy, onStatus, onOpenTable, onRejectOrder }: RequestCardProps) {
  const type = requestTypeMeta(request.requestType);
  const status = requestStatusMeta(request.status);
  const isPending = request.status === "PENDING";
  const isOrder = request.requestType === "ORDER_REQUEST";
  const expired = isExpired(request, now);
  const step = nextRequestStep(request.status);
  const name = tableDisplayName(request.table);

  return (
    <li className="card relative overflow-hidden px-4 py-3">
      {isPending && <ToneStripe tone={type.tone} />}

      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span aria-hidden="true" className={cn("flex size-9 shrink-0 items-center justify-center rounded-md text-lg", TONE_TINT[type.tone])}>
            {type.icon}
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-fg">{type.label}</h2>
            <p className="text-2xs text-fg-secondary">
              {name} · {formatTimeAgo(request.createdAt, now)}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          {expired && isPending && <span className="text-2xs font-bold text-danger-fg">⏰ Süresi Doldu</span>}
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
      </div>

      {isOrder && request.orderPreview && <OrderPreview preview={request.orderPreview} />}
      {request.note && !isOrder && (
        <Alert tone="warning" size="sm" className="mt-2">
          📝 {request.note}
        </Alert>
      )}

      {isOrder && isPending && !expired && (
        <>
          {tableOrderRequests > 1 && (
            <Alert tone="warning" size="sm" className="mt-2">
              Bu masada {tableOrderRequests} talep var. Masadaki müşterinin söylediği kodu girin; masa o müşteriye açılır, diğer talepler kapanır.
            </Alert>
          )}
          <OrderRequestActions request={request} busy={busy} onOpen={onOpenTable} onReject={onRejectOrder} />
        </>
      )}

      {!isOrder && isOpenRequest(request) && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {step && (
            <Button
              variant={step.next === "COMPLETED" ? "success" : "primary"}
              size="sm"
              className="flex-1"
              loading={busy}
              onClick={() => onStatus(request, step.next)}
            >
              {step.label}
            </Button>
          )}
          <Button variant="danger-ghost" size="sm" disabled={busy} onClick={() => onStatus(request, "CANCELLED")}>
            <span aria-hidden="true">✕</span>
            <span className="sr-only">Talebi iptal et: {type.label}, {name}</span>
          </Button>
        </div>
      )}
    </li>
  );
}
