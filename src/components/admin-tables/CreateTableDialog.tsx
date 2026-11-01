"use client";

import { useId, useState, type FormEvent } from "react";
import { useApiMutation } from "@/hooks/useApiMutation";
import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";
import FormError from "@/components/ui/FormError";
import Modal from "@/components/ui/Modal";
import { adminTablesApi } from "./adminTables.api";

interface CreateTableForm {
  readonly tableNumber: string;
  readonly tableName: string;
}

const EMPTY_FORM: CreateTableForm = { tableNumber: "", tableName: "" };

interface CreateTableDialogProps {
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateTableDialog({ onClose, onCreated }: CreateTableDialogProps) {
  const [form, setForm] = useState<CreateTableForm>(EMPTY_FORM);
  const create = useApiMutation(adminTablesApi.create);
  const formId = useId();
  const canSubmit = !create.pending && form.tableNumber.trim() !== "";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    const result = await create.run({
      tableNumber: form.tableNumber.trim(),
      tableName: form.tableName.trim() || undefined,
    });
    if (result.ok) onCreated();
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
      <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <Field label="Masa Numarası *" htmlFor={`${formId}-number`}>
          <input
            id={`${formId}-number`}
            className="input"
            value={form.tableNumber}
            onChange={(e) => setForm((prev) => ({ ...prev, tableNumber: e.target.value }))}
            placeholder="Örn: 12"
            required
            data-autofocus
          />
        </Field>
        <Field label="Masa Adı (Opsiyonel)" htmlFor={`${formId}-name`}>
          <input
            id={`${formId}-name`}
            className="input"
            value={form.tableName}
            onChange={(e) => setForm((prev) => ({ ...prev, tableName: e.target.value }))}
            placeholder="Örn: Bahçe 3, Teras 1"
          />
        </Field>
        <FormError message={create.error} />
      </form>
    </Modal>
  );
}
