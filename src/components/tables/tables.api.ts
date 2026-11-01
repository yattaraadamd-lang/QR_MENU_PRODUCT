import { apiRequest } from "@/lib/api-client";
import type { BillDetailDTO, CollectPaymentInput, TableDTO } from "./types";

const id = (value: string) => encodeURIComponent(value);

/** useApiQuery `select`: liste uçları `{ tables: [...] }` döner */
export function selectTables(json: unknown): TableDTO[] {
  const tables = (json as { tables?: unknown } | null)?.tables;
  return Array.isArray(tables) ? (tables as TableDTO[]) : [];
}

/** Admin ve garson masa ekranlarının ortak yazma/okuma uçları */
export const tablesApi = {
  getBill: async (sessionId: string, signal?: AbortSignal) => {
    const result = await apiRequest<{ bill: BillDetailDTO }>(`/api/bills/${id(sessionId)}`, {
      signal,
      fallbackError: "Adisyon yüklenemedi.",
    });
    return result.ok ? { ...result, data: result.data.bill } : result;
  },

  collectPayment: (input: CollectPaymentInput) =>
    apiRequest<unknown>("/api/waiter/payments/collect", {
      method: "POST",
      body: input,
      fallbackError: "Ödeme alınamadı.",
    }),

  closeSession: (sessionId: string) =>
    apiRequest<unknown>(`/api/table-sessions/${id(sessionId)}/close`, {
      method: "POST",
      body: { forceClose: false },
      fallbackError: "Masa kapatılamadı.",
    }),

  /** Yalnız admin: tamamlanmamış sipariş olsa da oturumu kapatır */
  forceClose: (tableId: string, closeReason: string) =>
    apiRequest<unknown>(`/api/admin/tables/${id(tableId)}/force-close`, {
      method: "POST",
      body: { closeReason },
      fallbackError: "Masa kapatılamadı.",
    }),
};
