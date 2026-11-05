import { apiRequest } from "@/lib/api-client";
import type { TableStatus } from "@/components/tables/types";

export interface CreateTableInput {
  readonly tableNumber: string;
  /** Boşsa gönderilmez: şema boş metni reddeder, sunucu "Masa <no>" adını verir */
  readonly tableName?: string;
}

export interface TableQrDTO {
  readonly tableId: string;
  readonly qrUrl: string;
  /** data:image/png;base64,… */
  readonly qrImageData: string;
  readonly tableNumber: string;
  readonly tableName: string | null;
}

export interface TableEventDTO {
  readonly id: string;
  readonly fromStatus: TableStatus;
  readonly toStatus: TableStatus;
  readonly source: "CUSTOMER" | "STAFF" | "SYSTEM";
  readonly reason: string;
  readonly actorName: string | null;
  readonly createdAt: string;
}

const id = (value: string) => encodeURIComponent(value);

/** Yalnız admin: masa ekle, QR üret / yenile, geçmiş, sil */
export const adminTablesApi = {
  create: (input: CreateTableInput) =>
    apiRequest<unknown>("/api/admin/tables", {
      method: "POST",
      body: input,
      fallbackError: "Masa oluşturulamadı.",
    }),

  generateQr: (tableId: string) =>
    apiRequest<TableQrDTO>(`/api/admin/tables/${id(tableId)}/generate-qr`, {
      method: "POST",
      fallbackError: "QR kodu oluşturulamadı.",
    }),

  rotateQr: (tableId: string) =>
    apiRequest<TableQrDTO>(`/api/admin/tables/${id(tableId)}/rotate-qr`, {
      method: "POST",
      fallbackError: "QR kodu yenilenemedi.",
    }),

  remove: (tableId: string) =>
    apiRequest<unknown>(`/api/admin/tables/${id(tableId)}`, {
      method: "DELETE",
      fallbackError: "Masa silinirken hata oluştu.",
    }),
};
