"use client";

import { useId, useState, type FormEvent } from "react";
import { invalidProps } from "@/components/ui/Field";
import { useApiMutation } from "@/hooks/useApiMutation";
import { FIELDS_INVALID, useFieldErrors } from "@/hooks/useFieldErrors";
import { EMPTY_PRODUCT_FORM, isFormValid, toFormValues, toProductInput } from "./productModel";
import { productsApi } from "./products.api";
import type { ProductDTO, ProductFormValues } from "./types";

/** Sunucunun hatasını altında gösterebildiğimiz alanlar (istek gövdesindeki adlarıyla) */
const ERROR_FIELDS = ["name", "description", "price", "ingredients", "allergens"] as const;

interface Options {
  /** null: yeni ürün */
  product: ProductDTO | null;
  /** Yeni ürün listenin sonuna gelir; sıra listeden değiştirilir */
  nextOrder: number;
  onSaved: (message: string) => void;
}

/**
 * Ürün formunun durumu (FE-ARCH-3.9c): değerler, kaydetme, sunucunun alan hataları ve alanı
 * hatasına bağlayan id/aria öznitelikleri. ProductFormDialog yalnız formu çizer.
 */
export function useProductForm({ product, nextOrder, onSaved }: Options) {
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

  return { id, values, set, bind, fields, save, canSubmit, handleSubmit };
}
