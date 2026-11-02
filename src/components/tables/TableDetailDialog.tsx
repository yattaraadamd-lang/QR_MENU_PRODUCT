"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { formatClock, formatTRY } from "@/lib/format";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Loader from "@/components/ui/Loader";
import Modal from "@/components/ui/Modal";
import { eyebrowClass } from "@/components/ui/tone";
import BillAmounts from "./BillAmounts";
import { paymentMethodLabel } from "@/components/payments/paymentMethods";
import { BILL_PAYMENT_STATUS, tableDisplayName, tableStatusMeta } from "./tableModel";
import type { BillState } from "./useTableDetail";
import type { BillDetailDTO, TableDTO } from "./types";

interface TableDetailDialogProps {
  table: TableDTO;
  billState: BillState;
  onRetry: () => void;
  onClose: () => void;
  /** Aktif oturumda alt çubuk eylemleri (ödeme al, kapat) */
  actions?: ReactNode;
}

/** Masa detayı: durum, adisyon, siparişler ve ödeme geçmişi. */
export default function TableDetailDialog({ table, billState, onRetry, onClose, actions }: TableDetailDialogProps) {
  const session = table.activeSession;

  return (
    <Modal
      onClose={onClose}
      size="md"
      dividers
      title={tableDisplayName(table)}
      description={
        <>
          {tableStatusMeta(table.status).label}
          {session && <span className="text-success-fg"> · Oturum açılışı {formatClock(session.startedAt)}</span>}
        </>
      }
      footer={session ? actions : undefined}
    >
      <DetailBody hasSession={session !== null} billState={billState} onRetry={onRetry} />
    </Modal>
  );
}

function DetailBody({ hasSession, billState, onRetry }: { hasSession: boolean; billState: BillState; onRetry: () => void }) {
  if (!hasSession) return <EmptyState variant="plain" icon="⚪" title="Bu masa şu anda boş" />;

  switch (billState.status) {
    case "idle":
    case "loading":
      return <Loader label="Adisyon yükleniyor" />;
    case "error":
      return (
        <Alert
          tone="danger"
          role="alert"
          action={
            <Button variant="ghost" size="sm" onClick={onRetry}>
              Tekrar dene
            </Button>
          }
        >
          {billState.error}
        </Alert>
      );
    case "ready":
      return <BillDetail bill={billState.bill} />;
  }
}

function BillDetail({ bill }: { bill: BillDetailDTO }) {
  const paymentStatus = BILL_PAYMENT_STATUS[bill.paymentStatus] ?? BILL_PAYMENT_STATUS.UNPAID;
  const orders = bill.tableSession?.orders ?? [];

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-md bg-surface-hover p-4">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <h3 className={eyebrowClass}>Adisyon</h3>
          <Badge tone={paymentStatus.tone}>{paymentStatus.label}</Badge>
        </div>
        <BillAmounts bill={bill} variant="detail" />
      </section>

      {orders.length > 0 && (
        <section>
          <h3 className={cn("mb-2", eyebrowClass)}>Siparişler</h3>
          <ul className="flex flex-col gap-2">
            {orders.map((order) => (
              <li key={order.id} className="rounded-md border border-line-subtle bg-surface px-3.5 py-2.5 text-xs">
                <div className="mb-1 flex justify-between gap-2">
                  <span className="text-fg-secondary">{formatClock(order.createdAt)}</span>
                  <span className="font-bold tabular-nums text-primary-light">{formatTRY(order.totalPrice)}</span>
                </div>
                <ul className="text-fg-secondary">
                  {order.items.map((item) => (
                    <li key={item.id} className="flex justify-between gap-2">
                      <span>
                        {item.quantity}× {item.productName}
                      </span>
                      <span className="tabular-nums">{formatTRY(item.totalPrice)}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}

      {bill.payments.length > 0 && (
        <section>
          <h3 className={cn("mb-1", eyebrowClass)}>Ödeme Geçmişi</h3>
          <ul className="divide-y divide-line-subtle text-xs">
            {bill.payments.map((payment) => (
              <li key={payment.id} className="flex justify-between gap-2 py-1.5">
                <span className="text-fg-secondary">
                  {paymentMethodLabel(payment.method)}
                  {payment.handledByWaiterName && ` · ${payment.handledByWaiterName}`}
                </span>
                <span className="font-bold tabular-nums text-success-fg">+{formatTRY(payment.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
