import { apiRequest } from "@/lib/api-client";
import type { CategoryDTO, CategoryInput } from "./types";

export const CATEGORIES_URL = "/api/admin/categories";

/** useApiQuery `select`: uç `{ categories: [...] }` döner (sortOrder'a göre sıralı) */
export function selectCategories(json: unknown): CategoryDTO[] {
  const list = (json as { categories?: unknown } | null)?.categories;
  return Array.isArray(list) ? (list as CategoryDTO[]) : [];
}

const itemUrl = (id: string) => `${CATEGORIES_URL}/${encodeURIComponent(id)}`;
const SAVE_ERROR = "Kategori kaydedilemedi.";

export const categoriesApi = {
  /** id yoksa oluşturur; sortOrder yalnız yeni kategoride (düzenleme sırayı değiştirmez) */
  save: (id: string | null, input: CategoryInput, sortOrder: number) =>
    id
      ? apiRequest<unknown>(itemUrl(id), { method: "PUT", body: input, fallbackError: SAVE_ERROR })
      : apiRequest<unknown>(CATEGORIES_URL, { method: "POST", body: { ...input, sortOrder }, fallbackError: SAVE_ERROR }),

  /** Ürünü olan kategoride sunucu nedenini döner */
  remove: (id: string) => apiRequest<unknown>(itemUrl(id), { method: "DELETE", fallbackError: "Kategori silinemedi." }),

  reorder: (items: readonly CategoryDTO[]) =>
    apiRequest<unknown>(`${CATEGORIES_URL}/reorder`, {
      method: "PATCH",
      body: { items: items.map(({ id, sortOrder }) => ({ id, sortOrder })) },
      fallbackError: "Sıralama kaydedilemedi.",
    }),
};
