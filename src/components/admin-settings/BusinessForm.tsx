"use client";

import { useId, useState, type FormEvent } from "react";
import { useApiMutation } from "@/hooks/useApiMutation";
import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";
import FormError from "@/components/ui/FormError";
import { businessApi, toBusinessInput, toFormValues } from "./business.api";
import { BUSINESS_LIMITS, type BusinessDTO, type BusinessFormValues } from "./types";

interface BusinessFormProps {
  business: BusinessDTO;
  onSaved: (business: BusinessDTO) => void;
}

/** İşletme bilgileri; slug salt okunur (uç onu güncellemez) */
export default function BusinessForm({ business, onSaved }: BusinessFormProps) {
  const [values, setValues] = useState<BusinessFormValues>(() => toFormValues(business));
  const save = useApiMutation(businessApi.update);
  const id = useId();
  const canSubmit = values.name.trim().length > 0 && !save.pending;
  const set = (key: keyof BusinessFormValues, value: string) => setValues((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    const result = await save.run(toBusinessInput(values));
    if (!result.ok) return;
    // Kırpılan boşluklar da formda görünsün
    setValues(toFormValues(result.data.business));
    onSaved(result.data.business);
  };

  return (
    <form onSubmit={handleSubmit} className="card flex max-w-[600px] flex-col gap-4 p-6">
      <Field label="İşletme Adı" htmlFor={`${id}-name`}>
        <input
          id={`${id}-name`}
          className="input"
          value={values.name}
          onChange={(e) => set("name", e.target.value)}
          maxLength={BUSINESS_LIMITS.name}
          required
          autoComplete="off"
        />
      </Field>
      <Field label="Açıklama" htmlFor={`${id}-description`}>
        <textarea
          id={`${id}-description`}
          className="input h-20 resize-none"
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
          maxLength={BUSINESS_LIMITS.description}
        />
      </Field>
      <Field label="Slug" htmlFor={`${id}-slug`}>
        <input
          id={`${id}-slug`}
          className="input opacity-60"
          value={business.slug}
          disabled
          aria-describedby={`${id}-slug-hint`}
        />
        <p id={`${id}-slug-hint`} className="mt-1 text-2xs text-fg-secondary">
          Slug değiştirilemez
        </p>
      </Field>
      <div className="grid items-start gap-3 sm:grid-cols-2">
        <Field label="Telefon" htmlFor={`${id}-phone`}>
          <input
            id={`${id}-phone`}
            className="input"
            type="tel"
            value={values.phone}
            onChange={(e) => set("phone", e.target.value)}
            maxLength={BUSINESS_LIMITS.phone}
            autoComplete="off"
          />
        </Field>
        <Field label="E-posta" htmlFor={`${id}-email`}>
          <input
            id={`${id}-email`}
            className="input"
            type="email"
            value={values.email}
            onChange={(e) => set("email", e.target.value)}
            autoComplete="off"
          />
        </Field>
      </div>
      <Field label="Adres" htmlFor={`${id}-address`}>
        <textarea
          id={`${id}-address`}
          className="input h-[60px] resize-none"
          value={values.address}
          onChange={(e) => set("address", e.target.value)}
          maxLength={BUSINESS_LIMITS.address}
        />
      </Field>
      <FormError message={save.error} />
      <Button type="submit" size="lg" className="mt-2" loading={save.pending} disabled={!canSubmit}>
        {save.pending ? (
          "Kaydediliyor..."
        ) : (
          <>
            <span aria-hidden="true">💾</span> Kaydet
          </>
        )}
      </Button>
    </form>
  );
}
