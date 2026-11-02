import { CheckCircle2, XCircle } from "lucide-react";
import { formatTRY } from "@/lib/format";
import { paymentMethodLabel } from "@/components/payments/paymentMethods";
import { tableDisplayName } from "@/components/tables/tableModel";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import ToneStripe from "@/components/ui/ToneStripe";
import type { PaymentRequestDTO } from "./types";

interface ApprovalRequestCardProps {
  request: PaymentRequestDTO;
  approving: boolean;
  onApprove: (request: PaymentRequestDTO) => void;
  onReject: (request: PaymentRequestDTO) => void;
}

/** Garson/müşteri ödeme bildirimi: kim, hangi yöntem, ne kadar; onayla ya da reddet */
export default function ApprovalRequestCard({ request, approving, onApprove, onReject }: ApprovalRequestCardProps) {
  const isCash = request.method === "CASH";

  return (
    <li className="card relative flex flex-col justify-between gap-4 p-5">
      <ToneStripe tone="warning" />
      <div>
        <div className="mb-3 flex items-start justify-between gap-2">
          <h3 className="text-lg font-bold text-fg">{tableDisplayName(request.table)}</h3>
          <Badge tone="warning" className="shrink-0">
            Onay Bekliyor
          </Badge>
        </div>

        <dl className="mb-3 flex flex-col gap-0.5 text-sm text-fg-secondary">
          <DetailRow label="Garson" value={request.requestedByName || "Belirtilmedi"} />
          <DetailRow label="Yöntem" value={paymentMethodLabel(request.method)} />
          {isCash && request.receivedAmount && (
            <DetailRow
              label="Alınan Nakit"
              value={`${formatTRY(request.receivedAmount)} (Üstü: ${formatTRY(request.changeAmount ?? 0)})`}
            />
          )}
          {request.note && <DetailRow label="Not" value={request.note} />}
        </dl>

        <div className="flex items-baseline justify-between gap-2 border-t border-line-subtle pt-2">
          <span className="font-semibold text-fg">Tahsil Edilecek</span>
          <span className="text-lg font-extrabold tabular-nums text-primary-light">{formatTRY(request.amount)}</span>
        </div>
      </div>

      {/* .btn satır kırmaz: dar ekranda "Reddet" alt satıra geçer */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="success"
          className="flex-[2]"
          loading={approving}
          leftIcon={<CheckCircle2 className="size-4" />}
          onClick={() => onApprove(request)}
        >
          Onayla ve Tahsil Et
        </Button>
        <Button
          variant="danger"
          className="flex-1"
          disabled={approving}
          leftIcon={<XCircle className="size-4" />}
          onClick={() => onReject(request)}
        >
          Reddet
        </Button>
      </div>
    </li>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1">
      <dt className="font-semibold text-fg">{label}:</dt>
      <dd className="min-w-0 break-words">{value}</dd>
    </div>
  );
}
