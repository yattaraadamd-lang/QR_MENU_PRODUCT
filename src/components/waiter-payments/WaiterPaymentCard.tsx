import type { ReactNode } from "react";
import { CheckCircle2, Clock, CreditCard, XCircle } from "lucide-react";
import { formatClock, formatTRY } from "@/lib/format";
import { paymentMethodLabel } from "@/components/payments/paymentMethods";
import { tableDisplayName } from "@/components/tables/tableModel";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import ToneStripe from "@/components/ui/ToneStripe";
import type { Tone } from "@/components/ui/tone";
import type { WaiterPaymentDTO, WaiterPaymentStatus } from "./types";

const ICON_CLASS = "size-3 shrink-0";

const STATUS: Readonly<Record<WaiterPaymentStatus, { label: string; tone: Tone; icon: ReactNode }>> = {
  PENDING: { label: "Müşteri Talebi", tone: "warning", icon: <Clock aria-hidden="true" className={ICON_CLASS} /> },
  AWAITING_ADMIN_APPROVAL: {
    label: "Admin Onayı Bekleniyor",
    tone: "info",
    icon: <CheckCircle2 aria-hidden="true" className={ICON_CLASS} />,
  },
  REJECTED: { label: "Admin Reddetti", tone: "danger", icon: <XCircle aria-hidden="true" className={ICON_CLASS} /> },
};

interface WaiterPaymentCardProps {
  payment: WaiterPaymentDTO;
  onSend: (payment: WaiterPaymentDTO) => void;
}

/** Ödeme talebi: durum, red nedeni ya da onay bilgisi, tutar ve "admin onayına gönder" */
export default function WaiterPaymentCard({ payment, onSend }: WaiterPaymentCardProps) {
  const status = STATUS[payment.status] ?? STATUS.PENDING;
  const isAwaiting = payment.status === "AWAITING_ADMIN_APPROVAL";
  const isRejected = payment.status === "REJECTED";
  const name = tableDisplayName(payment.table);

  return (
    <li className="card relative flex flex-col gap-2.5 p-4">
      <ToneStripe tone={status.tone} />

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-fg">{name}</h2>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-fg-secondary">
            <Clock aria-hidden="true" className="size-3" />
            Talep: {formatClock(payment.requestedAt ?? payment.createdAt)}
          </p>
        </div>
        <Badge tone={status.tone} className="shrink-0">
          {status.icon}
          {status.label}
        </Badge>
      </div>

      {isRejected && payment.rejectionReason && (
        <Alert tone="danger" size="sm">
          <strong>Red Nedeni:</strong> {payment.rejectionReason}
        </Alert>
      )}

      {isAwaiting && (
        <Alert tone="info" size="sm">
          Garson{payment.requestedByName ? ` (${payment.requestedByName})` : ""} admin onayına gönderdi. (Yöntem:{" "}
          {paymentMethodLabel(payment.method)}, Tutar: {formatTRY(payment.amount)})
        </Alert>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2.5">
        <p>
          <span className="text-lg font-bold tabular-nums text-primary-light">{formatTRY(payment.amount)}</span>
          {payment.bill && (
            <span className="ml-2 text-xs text-fg-secondary">
              (Adisyon Kalanı: {formatTRY(payment.bill.remainingAmount)})
            </span>
          )}
        </p>

        {isAwaiting ? (
          <span className="text-sm font-semibold text-fg-muted">Onay bekleniyor…</span>
        ) : (
          <Button
            variant={isRejected ? "danger" : "primary"}
            size="sm"
            leftIcon={<CreditCard className="size-3.5" />}
            aria-label={`${name}: ${isRejected ? "düzenle ve tekrar gönder" : "admin onayına gönder"}`}
            onClick={() => onSend(payment)}
          >
            {isRejected ? "Düzenle ve Tekrar Gönder" : "Admin Onayına Gönder"}
          </Button>
        )}
      </div>
    </li>
  );
}
