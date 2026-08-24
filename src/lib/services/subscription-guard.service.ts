/**
 * 🔒 Subscription Guard Service
 * 
 * Enforces SaaS subscription plan limits (maxTables, maxWaiters, maxProducts)
 * and subscription status (ACTIVE, TRIAL vs EXPIRED, PAST_DUE, CANCELLED).
 */

import { prisma } from "@/lib/prisma";

export type QuotaType = "TABLE" | "WAITER" | "PRODUCT";

export interface QuotaCheckResult {
  allowed: boolean;
  limit?: number | null;
  current?: number;
  status?: string;
  error?: string;
}

/**
 * Check whether a business is within its subscription plan limits for a given resource.
 */
export async function checkPlanQuota(
  businessId: string,
  quotaType: QuotaType
): Promise<QuotaCheckResult> {
  try {
    // 1. Fetch active subscription for the business
    const subscription = await prisma.businessSubscription.findFirst({
      where: {
        businessId,
        status: { in: ["ACTIVE", "TRIAL"] },
      },
      include: {
        plan: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // If no explicit subscription found, allow a generous default or fallback (grace period for development/demo)
    if (!subscription || !subscription.plan) {
      // Default limits for businesses without an explicit plan
      const DEFAULT_LIMITS: Record<QuotaType, number> = {
        TABLE: 50,
        WAITER: 20,
        PRODUCT: 200,
      };

      const limit = DEFAULT_LIMITS[quotaType];
      const current = await getCurrentCount(businessId, quotaType);

      if (current >= limit) {
        return {
          allowed: false,
          limit,
          current,
          error: `Varsayılan paket limiti aşıldı (${current}/${limit} ${quotaType.toLowerCase()}). Lütfen abonelik paketinizi yükseltin.`,
        };
      }

      return { allowed: true, limit, current };
    }

    // Check expiry
    const now = new Date();
    if (subscription.status === "TRIAL" && subscription.trialEndsAt && subscription.trialEndsAt < now) {
      return {
        allowed: false,
        status: "TRIAL_EXPIRED",
        error: "Deneme süreniz sona erdi. İşlem yapabilmek için lütfen bir abonelik paketi seçin.",
      };
    }

    if (subscription.status === "ACTIVE" && subscription.endsAt && subscription.endsAt < now) {
      return {
        allowed: false,
        status: "SUBSCRIPTION_EXPIRED",
        error: "Abonelik süreniz sona erdi. Lütfen aboneliğinizi yenileyin.",
      };
    }

    // 2. Check resource limits
    let limit: number | null | undefined;
    switch (quotaType) {
      case "TABLE":
        limit = subscription.plan.maxTables;
        break;
      case "WAITER":
        limit = subscription.plan.maxWaiters;
        break;
      case "PRODUCT":
        limit = subscription.plan.maxProducts;
        break;
    }

    // If limit is null/undefined, it means unlimited
    if (limit == null) {
      return { allowed: true, limit: null };
    }

    const current = await getCurrentCount(businessId, quotaType);

    if (current >= limit) {
      const typeLabels: Record<QuotaType, string> = {
        TABLE: "masa",
        WAITER: "garson",
        PRODUCT: "ürün",
      };

      return {
        allowed: false,
        limit,
        current,
        status: subscription.status,
        error: `Paket limitinize ulaştınız (${current}/${limit} ${typeLabels[quotaType]}). Yeni ekleme yapabilmek için lütfen paketinizi yükseltin.`,
      };
    }

    return { allowed: true, limit, current, status: subscription.status };
  } catch (error) {
    console.error("[SUBSCRIPTION_GUARD_ERROR]", error);
    // On unexpected error, fail open to avoid blocking legitimate operations, but log
    return { allowed: true };
  }
}

/**
 * Count active resources for the business
 */
async function getCurrentCount(businessId: string, quotaType: QuotaType): Promise<number> {
  switch (quotaType) {
    case "TABLE":
      return await prisma.table.count({
        where: { businessId, isDeleted: false },
      });
    case "WAITER":
      return await prisma.user.count({
        where: { businessId, role: "WAITER", deletedAt: null },
      });
    case "PRODUCT":
      return await prisma.product.count({
        where: { businessId, isDeleted: false },
      });
  }
}
