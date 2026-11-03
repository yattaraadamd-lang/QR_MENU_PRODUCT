"use client";

import { useId } from "react";
import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";
import FormError from "@/components/ui/FormError";
import type { BillingCustomer, PlanDTO } from "./types";
import { useCheckout } from "./useCheckout";

interface FieldDef {
  readonly key: keyof BillingCustomer;
  readonly label: string;
  readonly autoComplete: string;
  readonly inputMode?: "numeric" | "tel";
  readonly maxLength?: number;
  readonly placeholder?: string;
  readonly hint?: string;
}

const NAME_FIELDS: readonly FieldDef[] = [
  { key: "name", label: "Ad *", autoComplete: "given-name" },
  { key: "surname", label: "Soyad *", autoComplete: "family-name" },
];

const OTHER_FIELDS: readonly FieldDef[] = [
  { key: "gsmNumber", label: "Cep Telefonu *", autoComplete: "tel", inputMode: "tel", placeholder: "+905551234567" },
  {
    key: "identityNumber",
    label: "T.C. Kimlik No *",
    autoComplete: "off",
    inputMode: "numeric",
    maxLength: 11,
    hint: "Fatura için iyzico tarafından zorunlu tutulur.",
  },
  { key: "city", label: "Şehir *", autoComplete: "address-level2" },
  { key: "address", label: "Fatura Adresi *", autoComplete: "street-address" },
];

interface CheckoutPanelProps {
  plan: PlanDTO;
  onCancel: () => void;
  onStarted: () => void;
}

/** Seçilen plan için fatura bilgisi → iyzico güvenli ödeme formu */
export default function CheckoutPanel({ plan, onCancel, onStarted }: CheckoutPanelProps) {
  const checkout = useCheckout(plan, onStarted);
  const id = useId();

  const renderField = (field: FieldDef) => {
    const inputId = `${id}-${field.key}`;
    const hintId = field.hint ? `${inputId}-hint` : undefined;
    return (
      <Field key={field.key} label={field.label} htmlFor={inputId}>
        <input
          id={inputId}
          className="input"
          required
          value={checkout.customer[field.key]}
          onChange={(e) => checkout.setField(field.key, e.target.value)}
          autoComplete={field.autoComplete}
          inputMode={field.inputMode}
          maxLength={field.maxLength}
          placeholder={field.placeholder}
          aria-describedby={hintId}
        />
        {field.hint && (
          <p id={hintId} className="mt-1 text-2xs text-fg-secondary">
            {field.hint}
          </p>
        )}
      </Field>
    );
  };

  return (
    <section aria-labelledby={`${id}-title`} className="card max-w-lg p-5">
      <h2 id={`${id}-title`} className="mb-1 text-base font-bold text-fg">
        {plan.name} — Ödeme
      </h2>
      <p className="mb-4 text-xs text-fg-secondary">
        Ödeme iyzico güvenli ödeme sayfasında alınır. Kart bilgileriniz bize ulaşmaz.
      </p>

      <FormError message={checkout.error} className="mb-3" />

      {checkout.ready ? (
        <div ref={checkout.hostRef}>
          <div id="iyzipay-checkoutform" className="responsive" />
        </div>
      ) : (
        <form onSubmit={checkout.submit} className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">{NAME_FIELDS.map(renderField)}</div>
          {OTHER_FIELDS.map(renderField)}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onCancel}>
              Vazgeç
            </Button>
            <Button type="submit" className="flex-1" loading={checkout.submitting}>
              {checkout.submitting ? "Hazırlanıyor..." : "Ödemeye Geç"}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
