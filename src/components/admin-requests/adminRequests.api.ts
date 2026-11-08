import { selectRequests } from "@/components/requests/requests.api";
import type { AdminServiceRequestDTO } from "./types";

/** businessId oturumdan okunur (sorgu parametresi yok sayılır) */
export const ADMIN_REQUESTS_URL = "/api/service-requests";

/** useApiQuery `select`: garson ucuyla aynı `{ serviceRequests: [...] }` gövdesi, ek alanlarla */
export function selectAdminRequests(json: unknown): AdminServiceRequestDTO[] {
  return selectRequests(json) as AdminServiceRequestDTO[];
}
