import type { FilterTab } from "@/components/ui/FilterTabs";
import type { Tone } from "@/components/ui/tone";
import type { ProductDTO, ProductFormValues, ProductInput, StockStatus } from "./types";

export const STOCK: Readonly<Record<StockStatus, { readonly label: string; readonly tone: Tone }>> = {
  IN_STOCK: { label: "Stokta Var", tone: "success" },
  OUT_OF_STOCK: { label: "Stokta Yok", tone: "danger" },
  TEMPORARILY_UNAVAILABLE: { label: "Geçici Yok", tone: "warning" },
};

export const STOCK_VALUES = Object.keys(STOCK) as StockStatus[];

/** Sunucu bilinmeyen bir durum gönderirse "Stokta Var" gibi gösterilir */
export function stockMeta(status: StockStatus) {
  return STOCK[status] ?? STOCK.IN_STOCK;
}

/** lib/validation.ts createProductSchema ile aynı */
export const PRODUCT_LIMITS = { name: 200, description: 1000, ingredients: 1000, allergens: 500 } as const;

export const EMPTY_PRODUCT_FORM: ProductFormValues = {
  name: "",
  description: "",
  ingredients: "",
  allergens: "",
  price: "",
  categoryId: "",
  isAvailable: true,
  stockStatus: "IN_STOCK",
  isPopular: false,
};

export function toFormValues(product: ProductDTO): ProductFormValues {
  return {
    name: product.name,
    description: product.description ?? "",
    ingredients: product.ingredients ?? "",
    allergens: product.allergens ?? "",
    price: String(Number(product.price)),
    categoryId: product.category?.id ?? "",
    isAvailable: product.isAvailable,
    stockStatus: product.stockStatus,
    isPopular: product.isPopular,
  };
}

export function isFormValid(values: ProductFormValues): boolean {
  return values.name.trim().length > 0 && Number(values.price) > 0;
}

export function toProductInput(values: ProductFormValues): ProductInput {
  return {
    name: values.name.trim(),
    description: values.description.trim() || null,
    ingredients: values.ingredients.trim() || null,
    allergens: values.allergens.trim() || null,
    price: Number(values.price),
    categoryId: values.categoryId || null,
    isAvailable: values.isAvailable,
    stockStatus: values.stockStatus,
    isPopular: values.isPopular,
  };
}

/** Sekme değeri: tümü, kategorisiz ya da kategori id'si */
export const FILTER_ALL = "all";
export const FILTER_NO_CATEGORY = "none";

const foldTurkish = (text: string) => text.toLocaleLowerCase("tr");

export function filterProducts(products: readonly ProductDTO[], filter: string, search: string): ProductDTO[] {
  const query = foldTurkish(search.trim());
  return products.filter((product) => {
    if (filter === FILTER_NO_CATEGORY && product.category) return false;
    if (filter !== FILTER_ALL && filter !== FILTER_NO_CATEGORY && product.category?.id !== filter) return false;
    return !query || foldTurkish(product.name).includes(query);
  });
}

/** Sekmeler sayaçlarıyla; "Kategorisiz" yalnız böyle ürün varken (müşteri menüsünde görünmezler) */
export function productTabs(
  products: readonly ProductDTO[],
  categories: readonly { readonly id: string; readonly name: string }[],
): FilterTab<string>[] {
  const uncategorized = products.filter((product) => !product.category).length;
  return [
    { value: FILTER_ALL, label: "Tümü", count: products.length },
    ...categories.map((category) => ({
      value: category.id,
      label: category.name,
      count: products.filter((product) => product.category?.id === category.id).length,
    })),
    ...(uncategorized > 0
      ? [{ value: FILTER_NO_CATEGORY, label: "Kategorisiz", count: uncategorized, tone: "warning" as const }]
      : []),
  ];
}
