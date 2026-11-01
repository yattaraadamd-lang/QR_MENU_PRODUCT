"use client";

import { useId, type FormEvent } from "react";
import { formatTRY } from "@/lib/format";
import Alert from "@/components/ui/Alert";
import AmountInput from "@/components/ui/AmountInput";
import Button from "@/components/ui/Button";
import ChoiceGroup from "@/components/ui/ChoiceGroup";
import Field from "@/components/ui/Field";
import FormError from "@/components/ui/FormError";
import Modal from "@/components/ui/Modal";
import { PAYMENT_METHOD_OPTIONS, tableDisplayName, toAmountInputValue } from "./tableModel";
import { usePaymentForm, type PaymentSummary } from "./usePaymentForm";
import type { TableBillDTO, TableDTO } from "./types";

interface PaymentDialogProps {
  table: TableDTO;
  sessionId: string;
  /** Kalan borç: tutar alanını önceden doldurur */
  bill: TableBillDTO | null;
  onClose: () => void;
  onPaid: () => void;
}

/** Ödeme al: tutar, yöntem, nakitte alınan tutar ve para üstü. */
export default function PaymentDialog({ table, sessionId, bill, onClose, onPaid }: PaymentDialogProps) {
  const form = usePaymentForm({
    sessionId,
    initialAmount: bill ? toAmountInputValue(bill.remainingAmount) : "",
    onPaid,
  });
  const formId = useId();
  const ids = { amount: `${formId}-amount`, received: `${formId}-received`, note: `${formId}-note` };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void form.submit();
  };

  return (
    <Modal
      onClose={onClose}
      title="💰 Ödeme Al"
      description={
        <>
          {tableDisplayName(table)}
          {bill && <span className="font-bold text-danger-fg"> · Kalan: {formatTRY(bill.remainingAmount)}</span>}
        </>
      }
      footer={
        <>
          <Button type="submit" form={formId} variant="success" className="flex-1" loading={form.pending} disabled={!form.canSubmit}>
            {form.pending ? "İşleniyor..." : "Ödemeyi Onayla"}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            İptal
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-3.5" noValidate>
        <Field label="Ödenecek Tutar (₺) *" htmlFor={ids.amount}>
          <AmountInput
            id={ids.amount}
            value={form.values.amount}
            onChange={(e) => form.setField("amount", e.target.value)}
            placeholder="0.00"
            required
            data-autofocus
          />
        </Field>

        <ChoiceGroup
          legend="Ödeme Yöntemi *"
          options={PAYMENT_METHOD_OPTIONS}
          value={form.values.method}
          onChange={form.setMethod}
        />

        {form.values.method === "CASH" && (
          <div>
            <Field label="Müşteriden Alınan Nakit (₺) *" htmlFor={ids.received}>
              <AmountInput
                id={ids.received}
                value={form.values.received}
                onChange={(e) => form.setField("received", e.target.value)}
                placeholder={form.summary.due > 0 ? form.summary.due.toFixed(2) : "250.00"}
                required
              />
            </Field>
            {form.summary.received > 0 && <ChangeSummary summary={form.summary} />}
          </div>
        )}

        <Field label="Not (opsiyonel)" htmlFor={ids.note}>
          <input
            id={ids.note}
            className="input"
            value={form.values.note}
            onChange={(e) => form.setField("note", e.target.value)}
            placeholder="Ödeme notu..."
          />
        </Field>

        <FormError message={form.error} />
      </form>
    </Modal>
  );
}

function ChangeSummary({ summary }: { summary: PaymentSummary }) {
  const enough = summary.change >= 0;
  return (
    <Alert tone={enough ? "success" : "danger"} className="mt-3">
      <dl>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-xs text-fg-secondary">Para Üstü</dt>
          <dd className="text-lg font-extrabold tabular-nums">{enough ? formatTRY(summary.change) : "⚠️ Yetersiz"}</dd>
        </div>
        {enough && summary.due > 0 && (
          <div className="mt-1.5 flex justify-between gap-2 border-t border-line-subtle pt-1.5 text-2xs">
            <dt className="text-fg-secondary">Ciroya yansıyacak</dt>
            <dd className="font-bold tabular-nums text-primary-light">{formatTRY(summary.due)}</dd>
          </div>
        )}
      </dl>
    </Alert>
  );
}
