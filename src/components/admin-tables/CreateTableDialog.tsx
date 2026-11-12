"use client";

import { useId, useState, type FormEvent } from "react";
import { TABLE_LIMITS } from "@/contracts/tables";
import { useApiMutation } from "@/hooks/useApiMutation";
import { FIELDS_INVALID, useFieldErrors } from "@/hooks/useFieldErrors";
import Button from "@/components/ui/Button";
import Field, { invalidProps } from "@/components/ui/Field";
import FormError from "@/components/ui/FormError";
import Modal from "@/components/ui/Modal";
import { adminTablesApi } from "./adminTables.api";

interface CreateTableForm {
  readonly tableNumber: string;
  readonly tableName: string;
}

const EMPTY_FORM: CreateTableForm = { tableNumber: "", tableName: "" };
/** Sunucunun hatasını altında gösterebildiğimiz alanlar (istek gövdesindeki adlarıyla) */
const ERROR_FIELDS = ["tableNumber", "tableName"] as const;

interface CreateTableDialogProps {
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateTableDialog({ onClose, onCreated }: CreateTableDialogProps) {
  const [form, setForm] = useState<CreateTableForm>(EMPTY_FORM);
  const create = useApiMutation(adminTablesApi.create);
  const fields = useFieldErrors(ERROR_FIELDS);
  const formId = useId();
  const numberId = `${formId}-number`;
  const nameId = `${formId}-name`;
  const canSubmit = !create.pending && form.tableNumber.trim() !== "";
  const set = (key: keyof CreateTableForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    fields.clear(key);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    const result = await create.run({
      tableNumber: form.tableNumber.trim(),
      tableName: form.tableName.trim() || undefined,
    });
    if (result.ok) onCreated();
    else if (fields.capture(result)) create.setError(FIELDS_INVALID);
  };

  return (
    <Modal
      onClose={onClose}
      title="Yeni Masa Ekle"
      footer={
        <>
          <Button type="submit" form={formId} className="flex-1" loading={create.pending} disabled={!canSubmit}>
            {create.pending ? "Oluşturuluyor..." : "Masa Oluştur"}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            İptal
          </Button>
        </>
      }
    >
      <form id={formId} ref={fields.formRef} onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <Field label="Masa Numarası *" htmlFor={numberId} error={fields.error("tableNumber")}>
          <input
            id={numberId}
            className="input"
            value={form.tableNumber}
            onChange={(e) => set("tableNumber", e.target.value)}
            placeholder="Örn: 12"
            maxLength={TABLE_LIMITS.number}
            required
            data-autofocus
            {...invalidProps(fields.error("tableNumber"), numberId)}
          />
        </Field>
        <Field label="Masa Adı (Opsiyonel)" htmlFor={nameId} error={fields.error("tableName")}>
          <input
            id={nameId}
            className="input"
            value={form.tableName}
            onChange={(e) => set("tableName", e.target.value)}
            placeholder="Örn: Bahçe 3, Teras 1"
            maxLength={TABLE_LIMITS.name}
            {...invalidProps(fields.error("tableName"), nameId)}
          />
        </Field>
        <FormError message={create.error} />
      </form>
    </Modal>
  );
}
