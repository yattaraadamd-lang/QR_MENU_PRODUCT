/** Süper admin platform ekranları sözleşmesi. Kaynak: /api/super-admin/{dashboard,subscriptions,users} */

import type { SubscriptionStatus } from "@/components/subscription/types";
import type { UserRole } from "@/contracts/users";
import type { Money } from "@/lib/format";

export type { UserRole };

export interface PlatformStatsDTO {
  readonly totalBusinesses: number;
  readonly activeBusinesses: number;
  readonly totalAdmins: number;
  readonly totalWaiters: number;
  readonly monthlyPlatformRevenue: number;
  readonly totalOrders: number;
}

export interface PlatformSubscriptionDTO {
  readonly id: string;
  readonly status: SubscriptionStatus;
  readonly startedAt: string;
  readonly endsAt: string | null;
  readonly trialEndsAt: string | null;
  readonly business: { readonly name: string } | null;
  readonly plan: { readonly name: string; readonly monthlyPrice: Money } | null;
}

export interface PlatformUserDTO {
  readonly id: string;
  readonly name: string | null;
  readonly email: string;
  readonly role: UserRole;
  readonly isActive: boolean;
  readonly deletedAt: string | null;
  readonly business: { readonly name: string } | null;
}
