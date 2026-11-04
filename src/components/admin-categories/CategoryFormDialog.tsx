"use client";

import { useId, useState, type FormEvent } from "react";
import { useApiMutation } from "@/hooks/useApiMutation";
import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";
import FormError from "@/components/ui/FormError";
import Modal from "@/components/ui/Modal";
import { categoriesApi } from "./categories.api";
import { CATEGORY_ICON_MAX, CATEGORY_NAME_MAX, type CategoryDTO } from "./types";

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
  const id = useId();
  const canSubmit = name.trim().length > 0 && !save.pending;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    const result = await save.run(category?.id ?? null, { name: name.trim(), icon: icon.trim() || null }, nextOrder);
    if (result.ok) onSaved(category ? "Kategori güncellendi" : "Kategori oluşturuldu");
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
      <form id={`${id}-form`} onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field label="Kategori Adı" htmlFor={`${id}-name`}>
          <input
            id={`${id}-name`}
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Örn: Sıcak İçecekler"
            maxLength={CATEGORY_NAME_MAX}
            required
            autoComplete="off"
            data-autofocus
          />
        </Field>
        <Field label="İkon (emoji)" htmlFor={`${id}-icon`}>
          <input
            id={`${id}-icon`}
            className="input"
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            placeholder="Örn: ☕"
            maxLength={CATEGORY_ICON_MAX}
            autoComplete="off"
          />
        </Field>
        <FormError message={save.error} />
      </form>
    </Modal>
  );
}
