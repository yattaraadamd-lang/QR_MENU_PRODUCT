import type { PlatformStatsDTO, PlatformSubscriptionDTO, PlatformUserDTO } from "./types";

export const PLATFORM_STATS_URL = "/api/super-admin/dashboard";
export const PLATFORM_SUBSCRIPTIONS_URL = "/api/super-admin/subscriptions";
export const PLATFORM_USERS_URL = "/api/super-admin/users";

/** useApiQuery `select`'leri: hata gövdesi useApiQuery'de hata olur, buraya gelmez */
export function selectStats(json: unknown): PlatformStatsDTO | null {
  return (json as { stats?: PlatformStatsDTO } | null)?.stats ?? null;
}

export function selectSubscriptions(json: unknown): PlatformSubscriptionDTO[] {
  const list = (json as { subscriptions?: unknown } | null)?.subscriptions;
  return Array.isArray(list) ? (list as PlatformSubscriptionDTO[]) : [];
}

export function selectUsers(json: unknown): PlatformUserDTO[] {
  const list = (json as { users?: unknown } | null)?.users;
  return Array.isArray(list) ? (list as PlatformUserDTO[]) : [];
}
