import { formatDateTime } from "@/lib/format";
import { tableDisplayName } from "@/components/tables/tableModel";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import OrderPreview from "@/components/waiter-requests/OrderPreview";
import { isOpenRequest, requestStatusMeta, requestTypeMeta } from "@/components/waiter-requests/requestModel";
import type { RequestStatus, ServiceRequestDTO } from "@/components/waiter-requests/types";
import AdminRequestActions from "./AdminRequestActions";
import type { AdminServiceRequestDTO } from "./types";

interface AdminRequestCardProps {
  request: AdminServiceRequestDTO;
  busy: boolean;
  onStatus: (request: ServiceRequestDTO, status: RequestStatus) => void;
  onOpenTable: (request: ServiceRequestDTO, code: string) => void;
  onRejectOrder: (request: ServiceRequestDTO) => void;
}

/** Admin talep kartı: tür, masa, tarih, not, tamamlanma; sipariş talebinde sepet özeti */
export default function AdminRequestCard({ request, busy, onStatus, onOpenTable, onRejectOrder }: AdminRequestCardProps) {
  const type = requestTypeMeta(request.requestType);
  const status = requestStatusMeta(request.status);
  const name = tableDisplayName(request.table);

  return (
    <li className="card px-[18px] py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold text-fg">
            <span aria-hidden="true">{type.icon} </span>
            {type.label}
          </h2>
          <p className="mt-0.5 text-[13px] text-fg-secondary">
            {name} · <time dateTime={request.createdAt}>{formatDateTime(request.createdAt)}</time>
          </p>
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>

      {request.note && (
        <Alert tone="warning" size="sm" className="mt-2">
          <span aria-hidden="true">📝 </span>
          {request.note}
        </Alert>
      )}
      {request.requestType === "ORDER_REQUEST" && request.orderPreview && <OrderPreview preview={request.orderPreview} />}
      {request.completedAt && (
        <p className="mt-1.5 text-2xs text-success-fg">
          <span aria-hidden="true">✅ </span>
          Tamamlandı: <time dateTime={request.completedAt}>{formatDateTime(request.completedAt)}</time>
        </p>
      )}

      {isOpenRequest(request) && (
        <AdminRequestActions
          request={request}
          context={`${type.label}, ${name}`}
          busy={busy}
          onStatus={onStatus}
          onOpenTable={onOpenTable}
          onRejectOrder={onRejectOrder}
        />
      )}
    </li>
  );
}
