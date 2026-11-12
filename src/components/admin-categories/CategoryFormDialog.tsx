"use client";

import { useId, useState, type FormEvent } from "react";
import { CATEGORY_LIMITS } from "@/contracts/categories";
import { useApiMutation } from "@/hooks/useApiMutation";
import { FIELDS_INVALID, useFieldErrors } from "@/hooks/useFieldErrors";
import Button from "@/components/ui/Button";
import Field, { invalidProps } from "@/components/ui/Field";
import FormError from "@/components/ui/FormError";
import Modal from "@/components/ui/Modal";
import { categoriesApi } from "@/components/categories/categories.api";
import type { CategoryDTO } from "@/components/categories/types";

/** Sunucunun hatasını altında gösterebildiğimiz alanlar (istek gövdesindeki adlarıyla) */
const ERROR_FIELDS = ["name", "icon"] as const;

interface CategoryFormDialogProps {
  /** null: yeni kategori */
  category: CategoryDTO | null;
  /** Yeni kategori listenin sonuna gelir; sıra listeden değiştirilir */
  nextOrder: number;
  onClose: () => void;
  onSaved: (message: string) => void;
}

export default function CategoryFormDialog({ category, nextOrder, onClose, onSaved }: CategoryFormDialogProps) {
  const [name, setName] = useState(category?.name ?? "");
  const [icon, setIcon] = useState(category?.icon ?? "");
  const save = useApiMutation(categoriesApi.save);
  const fields = useFieldErrors(ERROR_FIELDS);
  const id = useId();
  const nameId = `${id}-name`;
  const iconId = `${id}-icon`;
  const canSubmit = name.trim().length > 0 && !save.pending;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    const result = await save.run(category?.id ?? null, { name: name.trim(), icon: icon.trim() || null }, nextOrder);
    if (result.ok) onSaved(category ? "Kategori güncellendi" : "Kategori oluşturuldu");
    else if (fields.capture(result)) save.setError(FIELDS_INVALID);
  };

  return (
    <Modal
      size="md"
      title={category ? "Kategori Düzenle" : "Yeni Kategori"}
      onClose={onClose}
      footer={
        <>
          <Button type="submit" form={`${id}-form`} className="flex-1" loading={save.pending} disabled={!canSubmit}>
            {category ? "Güncelle" : "Oluştur"}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            İptal
          </Button>
        </>
      }
    >
      <form id={`${id}-form`} ref={fields.formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field label="Kategori Adı" htmlFor={nameId} error={fields.error("name")}>
          <input
            id={nameId}
            className="input"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              fields.clear("name");
            }}
            placeholder="Örn: Sıcak İçecekler"
            maxLength={CATEGORY_LIMITS.name}
            required
            autoComplete="off"
            data-autofocus
            {...invalidProps(fields.error("name"), nameId)}
          />
        </Field>
        <Field label="İkon (emoji)" htmlFor={iconId} error={fields.error("icon")}>
          <input
            id={iconId}
            className="input"
            value={icon}
            onChange={(e) => {
              setIcon(e.target.value);
              fields.clear("icon");
            }}
            placeholder="Örn: ☕"
            maxLength={CATEGORY_LIMITS.icon}
            autoComplete="off"
            {...invalidProps(fields.error("icon"), iconId)}
          />
        </Field>
        <FormError message={save.error} />
      </form>
    </Modal>
  );
}
