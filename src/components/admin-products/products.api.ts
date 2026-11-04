import { apiRequest } from "@/lib/api-client";
import type { ProductDTO, ProductInput, StockStatus } from "./types";

export const PRODUCTS_URL = "/api/admin/products";

/** useApiQuery `select`: liste düz sıralamayla gösterilir (sürükleme sortOrder'ı baştan numaralar) */
export function selectProducts(json: unknown): ProductDTO[] {
  const list = (json as { products?: unknown } | null)?.products;
  if (!Array.isArray(list)) return [];
  return [...(list as ProductDTO[])].sort((a, b) => a.sortOrder - b.sortOrder);
}

const itemUrl = (id: string) => `${PRODUCTS_URL}/${encodeURIComponent(id)}`;
const SAVE_ERROR = "Ürün kaydedilemedi.";

export const productsApi = {
  /** id yoksa oluşturur; sortOrder yalnız yeni üründe. Paket limiti gibi nedenler sunucudan gelir */
  save: (id: string | null, input: ProductInput, sortOrder: number) =>
    id
      ? apiRequest<unknown>(itemUrl(id), { method: "PUT", body: input, fallbackError: SAVE_ERROR })
      : apiRequest<unknown>(PRODUCTS_URL, { method: "POST", body: { ...input, sortOrder }, fallbackError: SAVE_ERROR }),

  remove: (id: string) => apiRequest<unknown>(itemUrl(id), { method: "DELETE", fallbackError: "Ürün silinemedi." }),

  /** Stok düğmesi: sipariş iptalindeki "stokta yok" gibi müsaitliği de birlikte değiştirir */
  setStock: (id: string, stockStatus: StockStatus) =>
    apiRequest<unknown>(itemUrl(id), {
      method: "PUT",
      body: { stockStatus, isAvailable: stockStatus === "IN_STOCK" },
      fallbackError: "Stok güncellenemedi.",
    }),

  reorder: (items: readonly ProductDTO[]) =>
    apiRequest<unknown>(`${PRODUCTS_URL}/reorder`, {
      method: "PATCH",
      body: { items: items.map(({ id, sortOrder }) => ({ id, sortOrder })) },
      fallbackError: "Sıralama kaydedilemedi.",
    }),
};
