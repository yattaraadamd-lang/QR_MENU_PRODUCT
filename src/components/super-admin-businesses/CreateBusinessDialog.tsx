"use client";

import { useId, useState, type FormEvent, type InputHTMLAttributes } from "react";
import { BUSINESS_LIMITS } from "@/contracts/business";
import { PASSWORD_LIMITS } from "@/contracts/users";
import { useApiMutation } from "@/hooks/useApiMutation";
import { cn } from "@/lib/cn";
import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";
import FormError from "@/components/ui/FormError";
import Modal from "@/components/ui/Modal";
import { eyebrowClass } from "@/components/ui/tone";
import { businessesApi } from "./businesses.api";
import type { CreateBusinessInput } from "./types";

const EMPTY: CreateBusinessInput = {
  name: "",
  email: "",
  phone: "",
  address: "",
  adminName: "",
  adminEmail: "",
  adminPassword: "",
};

/** Uzunluk sınırları sunucu şemasıyla ortak sabitlerden (contracts) */
type InputProps = Pick<InputHTMLAttributes<HTMLInputElement>, "type" | "placeholder" | "autoComplete" | "minLength" | "maxLength">;

interface FieldDef extends InputProps {
  readonly key: keyof CreateBusinessInput;
  readonly label: string;
  readonly required?: boolean;
  readonly hint?: string;
}

const NAME_FIELD: FieldDef = {
  key: "name",
  label: "İşletme Adı",
  required: true,
  placeholder: "Örn: Lezzet Cafe",
  autoComplete: "organization",
  maxLength: BUSINESS_LIMITS.name,
};
/** Geniş ekranda yan yana */
const CONTACT_FIELDS: readonly FieldDef[] = [
  { key: "email", label: "İşletme E-posta", type: "email", placeholder: "isletme@ornek.com", autoComplete: "off" },
  { key: "phone", label: "Telefon", type: "tel", placeholder: "05xx xxx xx xx", autoComplete: "off", maxLength: BUSINESS_LIMITS.phone },
];
const ADDRESS_FIELD: FieldDef = {
  key: "address",
  label: "Adres",
  placeholder: "İşletme adresi",
  autoComplete: "off",
  maxLength: BUSINESS_LIMITS.address,
};

// Süper adminin kendi e-posta/şifresi önerilmesin: yeni hesap alanları
const ADMIN_FIELDS: readonly FieldDef[] = [
  { key: "adminName", label: "Admin Adı", placeholder: "Yetkili Kişi Adı", autoComplete: "off" },
  { key: "adminEmail", label: "Admin E-posta", type: "email", required: true, placeholder: "admin@isletme.com", autoComplete: "off" },
  {
    key: "adminPassword",
    label: "Admin Şifresi",
    type: "password",
    required: true,
    placeholder: `En az ${PASSWORD_LIMITS.min} karakter`,
    autoComplete: "new-password",
    minLength: PASSWORD_LIMITS.min,
    maxLength: PASSWORD_LIMITS.max,
    hint: `${PASSWORD_LIMITS.min}–${PASSWORD_LIMITS.max} karakter, en az 1 harf ve 1 rakam içermeli`,
  },
];

interface CreateBusinessDialogProps {
  onClose: () => void;
  onCreated: (message: string) => void;
}

/** Yeni işletme + ilk admin hesabı */
export default function CreateBusinessDialog({ onClose, onCreated }: CreateBusinessDialogProps) {
  const [form, setForm] = useState<CreateBusinessInput>(EMPTY);
  const create = useApiMutation(businessesApi.create);
  const id = useId();
  const close = () => !create.pending && onClose();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = await create.run(form);
    if (result.ok) onCreated(result.data.message || "İşletme oluşturuldu.");
  };

  const renderField = (field: FieldDef) => {
    const inputId = `${id}-${field.key}`;
    const hintId = field.hint ? `${inputId}-hint` : undefined;
    return (
      <Field key={field.key} label={`${field.label}${field.required ? " *" : ""}`} htmlFor={inputId}>
        <input
          id={inputId}
          className="input"
          type={field.type ?? "text"}
          placeholder={field.placeholder}
          autoComplete={field.autoComplete}
          required={field.required}
          minLength={field.minLength}
          maxLength={field.maxLength}
          aria-describedby={hintId}
          value={form[field.key]}
          onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
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
    <Modal
      onClose={close}
      title="Yeni İşletme Ekle"
      size="md"
      footer={
        <>
          <Button variant="ghost" className="flex-1" disabled={create.pending} onClick={close}>
            İptal
          </Button>
          <Button type="submit" form={id} className="flex-1" loading={create.pending}>
            {create.pending ? "Oluşturuluyor..." : "İşletme Oluştur"}
          </Button>
        </>
      }
    >
      <form id={id} onSubmit={handleSubmit} className="flex flex-col gap-5">
        <fieldset className="flex flex-col gap-3.5">
          <legend className={cn("mb-1", eyebrowClass)}>İşletme Bilgileri</legend>
          {renderField(NAME_FIELD)}
          <div className="grid gap-3 sm:grid-cols-2">{CONTACT_FIELDS.map((f) => renderField(f))}</div>
          {renderField(ADDRESS_FIELD)}
        </fieldset>
        <fieldset className="flex flex-col gap-3.5">
          <legend className={cn("mb-1", eyebrowClass)}>Admin Hesabı</legend>
          {ADMIN_FIELDS.map((f) => renderField(f))}
        </fieldset>
        <FormError message={create.error} />
      </form>
    </Modal>
  );
}
