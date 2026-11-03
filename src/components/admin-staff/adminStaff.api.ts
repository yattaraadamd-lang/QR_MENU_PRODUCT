import { apiRequest } from "@/lib/api-client";
import type { InviteDTO, StaffMemberDTO } from "./types";

export const STAFF_URL = "/api/admin/staff";
export const INVITES_URL = "/api/admin/waiter-invites";

function listOf<T>(json: unknown, key: string): T[] {
  const list = (json as Record<string, unknown> | null)?.[key];
  return Array.isArray(list) ? (list as T[]) : [];
}

export const selectStaff = (json: unknown) => listOf<StaffMemberDTO>(json, "staff");
export const selectInvites = (json: unknown) => listOf<InviteDTO>(json, "invites");

interface CreatedInvite {
  readonly invite?: { readonly inviteUrl?: string; readonly inviteCode?: string; readonly expiresAt?: string };
}

export const adminStaffApi = {
  /** Sunucu güvenli tek kullanımlık kod üretir; veritabanında yalnız hash'i tutulur */
  createInvite: () =>
    apiRequest<CreatedInvite>(INVITES_URL, {
      method: "POST",
      body: {},
      fallbackError: "Davet linki oluşturulurken bir hata oluştu.",
    }),

  deleteInvite: (inviteId: string) =>
    apiRequest<unknown>(`${INVITES_URL}?id=${encodeURIComponent(inviteId)}`, {
      method: "DELETE",
      fallbackError: "Davet silinirken bir hata oluştu.",
    }),
};
