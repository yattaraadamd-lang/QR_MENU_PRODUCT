import { apiRequest } from "@/lib/api-client";
import type { BusinessDTO, CreateBusinessInput } from "./types";

export const BUSINESSES_URL = "/api/super-admin/businesses";

/** Sunucu kuralıyla aynı: 12–72 karakter, en az 1 harf ve 1 rakam */
export const ADMIN_PASSWORD_MIN = 12;
export const ADMIN_PASSWORD_MAX = 72;

export function selectBusinesses(json: unknown): BusinessDTO[] {
  const list = (json as { businesses?: unknown } | null)?.businesses;
  return Array.isArray(list) ? (list as BusinessDTO[]) : [];
}

export const businessesApi = {
  create: (input: CreateBusinessInput) =>
    apiRequest<{ message?: string }>(BUSINESSES_URL, {
      method: "POST",
      body: input,
      fallbackError: "İşletme oluşturulamadı.",
    }),

  setActive: (businessId: string, active: boolean) =>
    apiRequest<unknown>(`${BUSINESSES_URL}/${encodeURIComponent(businessId)}/${active ? "activate" : "deactivate"}`, {
      method: "PATCH",
      fallbackError: "İşletme durumu değiştirilemedi.",
    }),
};
