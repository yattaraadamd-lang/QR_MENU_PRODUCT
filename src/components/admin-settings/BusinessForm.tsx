"use client";

import { useId, useState, type FormEvent } from "react";
import { BUSINESS_LIMITS } from "@/contracts/business";
import { useApiMutation } from "@/hooks/useApiMutation";
import { FIELDS_INVALID, useFieldErrors } from "@/hooks/useFieldErrors";
import Button from "@/components/ui/Button";
import Field, { invalidProps } from "@/components/ui/Field";
import FormError from "@/components/ui/FormError";
import { businessApi, toBusinessInput, toFormValues } from "./business.api";
import type { BusinessDTO, BusinessFormValues } from "./types";

/** Sunucunun hatasını altında gösterebildiğimiz alanlar (istek gövdesindeki adlarıyla) */
const ERROR_FIELDS = ["name", "description", "phone", "email", "address"] as const;

interface BusinessFormProps {
  business: BusinessDTO;
  onSaved: (business: BusinessDTO) => void;
}

/** İşletme bilgileri; slug salt okunur (uç onu güncellemez) */
export default function BusinessForm({ business, onSaved }: BusinessFormProps) {
  const [values, setValues] = useState<BusinessFormValues>(() => toFormValues(business));
  const save = useApiMutation(businessApi.update);
  const fields = useFieldErrors(ERROR_FIELDS);
  const id = useId();
  const canSubmit = values.name.trim().length > 0 && !save.pending;
  const set = (key: keyof BusinessFormValues, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    fields.clear(key);
  };
  /** Alanın id'si ve hataya bağlayan öznitelikleri */
  const bind = (key: keyof BusinessFormValues) => ({ id: `${id}-${key}`, ...invalidProps(fields.error(key), `${id}-${key}`) });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    const result = await save.run(toBusinessInput(values));
    // Başarıda önceki alan hataları da temizlenir
    const invalid = fields.capture(result);
    if (!result.ok) {
      if (invalid) save.setError(FIELDS_INVALID);
      return;
    }
    // Kırpılan boşluklar da formda görünsün
    setValues(toFormValues(result.data.business));
    onSaved(result.data.business);
  };

  return (
    <form ref={fields.formRef} onSubmit={handleSubmit} className="card flex max-w-[600px] flex-col gap-4 p-6">
      <Field label="İşletme Adı" htmlFor={`${id}-name`} error={fields.error("name")}>
        <input
          {...bind("name")}
          className="input"
          value={values.name}
          onChange={(e) => set("name", e.target.value)}
          maxLength={BUSINESS_LIMITS.name}
          required
          autoComplete="off"
        />
      </Field>
      <Field label="Açıklama" htmlFor={`${id}-description`} error={fields.error("description")}>
        <textarea
          {...bind("description")}
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
        <Field label="Telefon" htmlFor={`${id}-phone`} error={fields.error("phone")}>
          <input
            {...bind("phone")}
            className="input"
            type="tel"
            value={values.phone}
            onChange={(e) => set("phone", e.target.value)}
            maxLength={BUSINESS_LIMITS.phone}
            autoComplete="off"
          />
        </Field>
        <Field label="E-posta" htmlFor={`${id}-email`} error={fields.error("email")}>
          <input
            {...bind("email")}
            className="input"
            type="email"
            value={values.email}
            onChange={(e) => set("email", e.target.value)}
            autoComplete="off"
          />
        </Field>
      </div>
      <Field label="Adres" htmlFor={`${id}-address`} error={fields.error("address")}>
        <textarea
          {...bind("address")}
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
