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

export interface CategoryInput {
  readonly name: string;
  readonly icon: string | null;
}

/** lib/validation.ts createCategorySchema ile aynı */
export const CATEGORY_NAME_MAX = 100;
export const CATEGORY_ICON_MAX = 50;
