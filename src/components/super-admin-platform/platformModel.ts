import { formatTRY } from "@/lib/format";
import type { Tone } from "@/components/ui/tone";
import type { PlatformStatsDTO, PlatformSubscriptionDTO, PlatformUserDTO, UserRole } from "./types";

interface Meta {
  readonly label: string;
  readonly tone: Tone;
}

const USER_ROLE: Readonly<Record<UserRole, Meta>> = {
  SUPER_ADMIN: { label: "Süper Admin", tone: "success" },
  ADMIN: { label: "Admin", tone: "primary" },
  WAITER: { label: "Garson", tone: "warning" },
};

/** Sunucu bilinmeyen bir rol gönderirse adı olduğu gibi gösterilir */
export function userRoleMeta(role: string): Meta {
  return USER_ROLE[role as UserRole] ?? { label: role, tone: "neutral" };
}

/** Silinmiş hesap "Pasif"ten ayrılır: geri açılamaz, kotaya sayılmaz */
export function userStatusMeta(user: Pick<PlatformUserDTO, "isActive" | "deletedAt">): Meta {
  if (user.deletedAt) return { label: "Silindi", tone: "neutral" };
  return user.isActive ? { label: "Aktif", tone: "success" } : { label: "Pasif", tone: "danger" };
}

/** Deneme aboneliğinde bitiş trialEndsAt'te: ikisi de yoksa süresiz */
export function subscriptionEnd(subscription: PlatformSubscriptionDTO): string | null {
  return subscription.endsAt ?? subscription.trialEndsAt;
}

export interface PlatformStat {
  readonly label: string;
  readonly value: number | string;
  readonly icon: string;
  readonly tone: Tone;
}

export function platformStats(stats: PlatformStatsDTO): PlatformStat[] {
  return [
    { label: "Toplam İşletme", value: stats.totalBusinesses, icon: "🏢", tone: "purple" },
    { label: "Aktif İşletme", value: stats.activeBusinesses, icon: "🟢", tone: "success" },
    { label: "Aylık Platform Geliri", value: formatTRY(stats.monthlyPlatformRevenue), icon: "💎", tone: "purple" },
    { label: "Toplam Admin", value: stats.totalAdmins, icon: "👑", tone: "warning" },
    { label: "Toplam Garson", value: stats.totalWaiters, icon: "👔", tone: "primary" },
    { label: "Toplam Sipariş", value: stats.totalOrders, icon: "📋", tone: "info" },
  ];
}
