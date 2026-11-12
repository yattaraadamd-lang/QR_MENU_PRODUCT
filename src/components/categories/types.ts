/** Admin kategorileri sözleşmesi. Kaynak: /api/admin/categories */

export interface CategoryDTO {
  readonly id: string;
  readonly name: string;
  readonly icon: string | null;
  readonly sortOrder: number;
  readonly isActive: boolean;
  /** Silinmemiş ürün sayısı: silme bunu kontrol eder */
  readonly _count: { readonly products: number };
}

/** Alan sınırları: contracts/categories.ts CATEGORY_LIMITS (sunucu şemasıyla ortak) */
export interface CategoryInput {
  readonly name: string;
  readonly icon: string | null;
}
