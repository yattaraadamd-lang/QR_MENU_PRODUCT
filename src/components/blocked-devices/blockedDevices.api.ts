import { apiRequest } from "@/lib/api-client";
import type { BlockFilter, BlockPage, DeviceBlockDTO, PaginationDTO } from "./types";

export const PAGE_SIZE = 20;

export function blocksUrl(filter: BlockFilter, page: number): string {
  const params = new URLSearchParams({ status: filter, page: String(page), limit: String(PAGE_SIZE) });
  return `/api/admin/customer-access-blocks?${params}`;
}

const EMPTY_PAGINATION: PaginationDTO = { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 };

/** useApiQuery `select`: `{ blocks, pagination }` */
export function selectBlockPage(json: unknown): BlockPage {
  const body = json as { blocks?: unknown; pagination?: PaginationDTO } | null;
  return {
    blocks: Array.isArray(body?.blocks) ? (body.blocks as DeviceBlockDTO[]) : [],
    pagination: body?.pagination ?? EMPTY_PAGINATION,
  };
}

export const blockedDevicesApi = {
  /** Engeli kaldırır; cihaz QR'ı yeniden okutunca yeni oturum açabilir */
  revoke: (blockId: string, note: string) =>
    apiRequest<unknown>(`/api/admin/customer-access-blocks/${encodeURIComponent(blockId)}/revoke`, {
      method: "PATCH",
      body: { note: note.trim() || null },
      fallbackError: "Engel kaldırılırken bir hata oluştu.",
    }),
};
