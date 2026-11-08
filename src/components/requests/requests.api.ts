import { apiRequest } from "@/lib/api-client";
import type { QueueFilter } from "@/components/staff/StaffQueueHeader";
import type { RequestStatus, ServiceRequestDTO } from "./types";

export const requestsUrl = (filter: QueueFilter) => `/api/waiter/service-requests?status=${filter}`;

/** useApiQuery `select`: uç `{ serviceRequests: [...] }` döner */
export function selectRequests(json: unknown): ServiceRequestDTO[] {
  const list = (json as { serviceRequests?: unknown } | null)?.serviceRequests;
  return Array.isArray(list) ? (list as ServiceRequestDTO[]) : [];
}

const base = (id: string) => `/api/waiter/service-requests/${encodeURIComponent(id)}`;

/** Talep uçları: garson ve yönetici ekranları aynı uçları kullanır */
export const requestsApi = {
  updateStatus: (id: string, status: RequestStatus) =>
    apiRequest<unknown>(`${base(id)}/status`, {
      method: "PUT",
      body: { status },
      fallbackError: "Talep güncellenemedi.",
    }),

  /** Müşterinin ekranındaki kodla masayı açar (atomik: oturum + sipariş izni) */
  openTable: (id: string, verificationCode: string) =>
    apiRequest<unknown>(`${base(id)}/open-table`, {
      method: "POST",
      body: { verificationCode },
      fallbackError: "Masa açma hatası.",
    }),

  /** Masada müşteri yok: oturum kapatılır, cihaz işletmede engellenir */
  rejectOrderRequest: (id: string) =>
    apiRequest<unknown>(`${base(id)}/reject-order-request`, {
      method: "POST",
      body: { reason: "EMPTY_TABLE_ABUSE" },
      fallbackError: "Sipariş talebi reddedilemedi.",
    }),
};
