/** Admin ürünleri sözleşmesi. Kaynak: /api/admin/products */

import type { StockStatus } from "@/contracts/products";
import type { Money } from "@/lib/format";

export type { StockStatus };

export interface ProductDTO {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly ingredients: string | null;
  readonly allergens: string | null;
  readonly price: Money;
  readonly isAvailable: boolean;
  readonly stockStatus: StockStatus;
  readonly isPopular: boolean;
  readonly sortOrder: number;
  readonly category: { readonly id: string; readonly name: string } | null;
}

/** Sunucuya giden alanlar (sortOrder yalnız yeni üründe, ayrı verilir) */
export interface ProductInput {
  readonly name: string;
  readonly description: string | null;
  readonly ingredients: string | null;
  readonly allergens: string | null;
  readonly price: number;
  readonly categoryId: string | null;
  readonly isAvailable: boolean;
  readonly stockStatus: StockStatus;
  readonly isPopular: boolean;
}

/** Form durumu: fiyat metin olarak tutulur (alan temizlenebilsin, "0" kendiliğinden yazılmasın) */
export interface ProductFormValues {
  readonly name: string;
  readonly description: string;
  readonly ingredients: string;
  readonly allergens: string;
  readonly price: string;
  readonly categoryId: string;
  readonly isAvailable: boolean;
  readonly stockStatus: StockStatus;
  readonly isPopular: boolean;
}
