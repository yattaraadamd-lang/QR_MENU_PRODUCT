"use client";

import { useId, useMemo } from "react";
import { formatTRY } from "@/lib/format";
import Alert from "@/components/ui/Alert";
import AmountInput from "@/components/ui/AmountInput";
import ChoiceGroup from "@/components/ui/ChoiceGroup";
import Field from "@/components/ui/Field";
import type { PaymentSummary } from "./paymentForm";
import { paymentMethodOptions, type PaymentMethod } from "./paymentMethods";
import type { PaymentFormState } from "./usePaymentFormState";

interface PaymentFieldsProps {
  form: PaymentFormState;
  methods: readonly PaymentMethod[];
  amountLabel: string;
  /** Opsiyonel not alanı */
  withNote?: boolean;
}

/** Tutar, yöntem, nakitte alınan tutar + para üstü (ve isteğe bağlı not) alanları */
export default function PaymentFields({ form, methods, amountLabel, withNote = false }: PaymentFieldsProps) {
  const id = useId();
  const options = useMemo(() => paymentMethodOptions(methods), [methods]);
  const { values, summary } = form;

  return (
    <>
      <Field label={amountLabel} htmlFor={`${id}-amount`}>
        <AmountInput
          id={`${id}-amount`}
          value={values.amount}
          onChange={(e) => form.setField("amount", e.target.value)}
          max={form.maxAmount}
          placeholder="0.00"
          required
          data-autofocus
        />
      </Field>

      <ChoiceGroup legend="Ödeme Yöntemi *" options={options} value={values.method} onChange={form.setMethod} />

      {values.method === "CASH" && (
        <div>
          <Field label="Müşteriden Alınan Nakit (₺) *" htmlFor={`${id}-received`}>
            <AmountInput
              id={`${id}-received`}
              value={values.received}
              onChange={(e) => form.setField("received", e.target.value)}
              placeholder={summary.due > 0 ? summary.due.toFixed(2) : "250.00"}
              required
            />
          </Field>
          {summary.received > 0 && <ChangeSummary summary={summary} />}
        </div>
      )}

      {withNote && (
        <Field label="Not (opsiyonel)" htmlFor={`${id}-note`}>
          <input
            id={`${id}-note`}
            className="input"
            value={values.note}
            onChange={(e) => form.setField("note", e.target.value)}
            placeholder="Ödeme notu..."
          />
        </Field>
      )}
    </>
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
