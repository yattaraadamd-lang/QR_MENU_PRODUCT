/** Ürün. Ürün DTO'ları şimdilik özellik klasörlerinde. */

export type StockStatus = "IN_STOCK" | "OUT_OF_STOCK" | "TEMPORARILY_UNAVAILABLE";

/** Ürün alanlarının azami uzunluğu */
export const PRODUCT_LIMITS = { name: 200, description: 1000, ingredients: 1000, allergens: 500 } as const;
