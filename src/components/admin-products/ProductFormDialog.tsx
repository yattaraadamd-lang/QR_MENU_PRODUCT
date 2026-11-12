"use client";

import { useId, useState, type FormEvent } from "react";
import { Star } from "lucide-react";
import { PRODUCT_LIMITS } from "@/contracts/products";
import { useApiMutation } from "@/hooks/useApiMutation";
import { FIELDS_INVALID, useFieldErrors } from "@/hooks/useFieldErrors";
import AmountInput from "@/components/ui/AmountInput";
import Button from "@/components/ui/Button";
import Field, { invalidProps } from "@/components/ui/Field";
import FormError from "@/components/ui/FormError";
import Modal from "@/components/ui/Modal";
import { EMPTY_PRODUCT_FORM, isFormValid, STOCK, STOCK_VALUES, toFormValues, toProductInput } from "./productModel";
import { productsApi } from "./products.api";
import type { ProductDTO, ProductFormValues, StockStatus } from "./types";

/** Sunucunun hatasını altında gösterebildiğimiz alanlar (istek gövdesindeki adlarıyla) */
const ERROR_FIELDS = ["name", "description", "price", "ingredients", "allergens"] as const;

interface ProductFormDialogProps {
  /** null: yeni ürün */
  product: ProductDTO | null;
  categories: readonly { readonly id: string; readonly name: string }[];
  /** Yeni ürün listenin sonuna gelir; sıra listeden değiştirilir */
  nextOrder: number;
  onClose: () => void;
  onSaved: (message: string) => void;
}

export default function ProductFormDialog({ product, categories, nextOrder, onClose, onSaved }: ProductFormDialogProps) {
  const [values, setValues] = useState<ProductFormValues>(() => (product ? toFormValues(product) : EMPTY_PRODUCT_FORM));
  const save = useApiMutation(productsApi.save);
  const fields = useFieldErrors(ERROR_FIELDS);
  const id = useId();
  const canSubmit = isFormValid(values) && !save.pending;
  const set = <K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    fields.clear(key);
  };
  /** Alanın id'si ve hataya bağlayan öznitelikleri */
  const bind = (key: (typeof ERROR_FIELDS)[number]) => ({ id: `${id}-${key}`, ...invalidProps(fields.error(key), `${id}-${key}`) });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    const result = await save.run(product?.id ?? null, toProductInput(values), nextOrder);
    if (result.ok) onSaved(product ? "Ürün güncellendi" : "Ürün eklendi");
    else if (fields.capture(result)) save.setError(FIELDS_INVALID);
  };

  return (
    <Modal
      size="md"
      dividers
      title={product ? "Ürünü Düzenle" : "Yeni Ürün Ekle"}
      onClose={onClose}
      footer={
        <>
          <Button type="submit" form={`${id}-form`} className="flex-1" loading={save.pending} disabled={!canSubmit}>
            {product ? "Güncelle" : "Ürün Ekle"}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            İptal
          </Button>
        </>
      }
    >
      <form id={`${id}-form`} ref={fields.formRef} onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <Field label="Ürün Adı" htmlFor={`${id}-name`} error={fields.error("name")}>
          <input
            {...bind("name")}
            className="input"
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Örn: Türk Kahvesi"
            maxLength={PRODUCT_LIMITS.name}
            required
            autoComplete="off"
            data-autofocus
          />
        </Field>
        <Field label="Açıklama" htmlFor={`${id}-description`} error={fields.error("description")}>
          <textarea
            {...bind("description")}
            className="input h-16 resize-none"
            value={values.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Kısa ürün açıklaması..."
            maxLength={PRODUCT_LIMITS.description}
          />
        </Field>
        <div className="grid grid-cols-2 items-start gap-3">
          <Field label="Fiyat (₺)" htmlFor={`${id}-price`} error={fields.error("price")}>
            <AmountInput {...bind("price")} value={values.price} onChange={(e) => set("price", e.target.value)} required />
          </Field>
          <Field label="Kategori" htmlFor={`${id}-category`}>
            <select
              id={`${id}-category`}
              className="input"
              value={values.categoryId}
              onChange={(e) => set("categoryId", e.target.value)}
              aria-describedby={values.categoryId ? undefined : `${id}-category-hint`}
            >
              <option value="">Kategorisiz</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {!values.categoryId && (
          <p id={`${id}-category-hint`} className="-mt-1.5 text-xs font-medium text-warning-fg">
            Kategorisiz ürünler müşteri menüsünde görünmez.
          </p>
        )}
        <Field label="Stok Durumu" htmlFor={`${id}-stock`}>
          <select
            id={`${id}-stock`}
            className="input"
            value={values.stockStatus}
            onChange={(e) => set("stockStatus", e.target.value as StockStatus)}
          >
            {STOCK_VALUES.map((status) => (
              <option key={status} value={status}>
                {STOCK[status].label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="İçindekiler" htmlFor={`${id}-ingredients`} error={fields.error("ingredients")}>
          <input
            {...bind("ingredients")}
            className="input"
            value={values.ingredients}
            onChange={(e) => set("ingredients", e.target.value)}
            placeholder="Espresso, süt, şeker..."
            maxLength={PRODUCT_LIMITS.ingredients}
          />
        </Field>
        <Field label="Alerjenler" htmlFor={`${id}-allergens`} error={fields.error("allergens")}>
          <input
            {...bind("allergens")}
            className="input"
            value={values.allergens}
            onChange={(e) => set("allergens", e.target.value)}
            placeholder="Süt ürünleri, gluten..."
            maxLength={PRODUCT_LIMITS.allergens}
          />
        </Field>
        <div className="flex flex-wrap gap-x-5 gap-y-2 py-1">
          <label className="flex cursor-pointer items-center gap-2 text-[13px] font-medium text-fg">
            <input
              type="checkbox"
              checked={values.isAvailable}
              onChange={(e) => set("isAvailable", e.target.checked)}
              className="size-4 accent-primary"
            />
            Menüde Görünsün
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-[13px] font-medium text-fg">
            <input
              type="checkbox"
              checked={values.isPopular}
              onChange={(e) => set("isPopular", e.target.checked)}
              className="size-4 accent-warning-fg"
            />
            <Star aria-hidden="true" className="size-3.5 text-warning-fg" /> Popüler
          </label>
        </div>
        <FormError message={save.error} />
      </form>
    </Modal>
  );
}
