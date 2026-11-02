import { apiRequest } from "@/lib/api-client";

export interface CreateTableInput {
  readonly tableNumber: string;
  /** Boşsa gönderilmez: şema boş metni reddeder, sunucu "Masa <no>" adını verir */
  readonly tableName?: string;
}

export interface TableQrDTO {
  readonly qrUrl: string;
  /** data:image/png;base64,… */
  readonly qrImageData: string;
  readonly tableNumber: string;
  readonly tableName: string | null;
}

const id = (value: string) => encodeURIComponent(value);

/** Yalnız admin: masa ekle, QR üret, sil */
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

  remove: (tableId: string) =>
    apiRequest<unknown>(`/api/admin/tables/${id(tableId)}`, {
      method: "DELETE",
      fallbackError: "Masa silinirken hata oluştu.",
    }),
};
