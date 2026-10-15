/**
 * Abonelik & Plan Limitleri
 *
 * - Geçerli abonelik: ACTIVE, veya trialEndsAt geçmemiş TRIAL.
 * - Limit null ise sınırsızdır.
 * - Geçerli aboneliği olmayan işletme yeni kaynak (masa/garson/ürün) ekleyemez.
 */

import { NextResponse } from "next/server";
import { prisma } from "./prisma";

export type LimitedResource = "tables" | "waiters" | "products";

const RESOURCE_LABELS: Record<LimitedResource, string> = {
  tables: "masa",
  waiters: "garson",
  products: "ürün",
};

/** İşletmenin en güncel aboneliğini ve geçerli olup olmadığını döndürür. */
export async function getCurrentSubscription(businessId: string) {
  const subscription = await prisma.businessSubscription.findFirst({
    where: { businessId, status: { in: ["TRIAL", "ACTIVE", "PAST_DUE"] } },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  });

  if (!subscription) return { subscription: null, isValid: false as const };

  const now = new Date();
  const trialExpired =
    subscription.status === "TRIAL" && !!subscription.trialEndsAt && subscription.trialEndsAt < now;
  const periodExpired =
    subscription.status === "ACTIVE" && !!subscription.endsAt && subscription.endsAt < now;

  return {
    subscription,
    isValid: subscription.status !== "PAST_DUE" && !trialExpired && !periodExpired,
  };
}

async function countResource(businessId: string, resource: LimitedResource) {
  switch (resource) {
    case "tables":
      return prisma.table.count({ where: { businessId, isDeleted: false } });
    case "waiters":
      return prisma.user.count({ where: { businessId, role: "WAITER", deletedAt: null } });
    case "products":
      return prisma.product.count({ where: { businessId, isDeleted: false } });
  }
}

/** Admin paneli için kullanım özeti */
export async function getUsageSummary(businessId: string) {
  const { subscription, isValid } = await getCurrentSubscription(businessId);
  const plan = subscription?.plan;

  const [tables, waiters, products] = await Promise.all([
    countResource(businessId, "tables"),
    countResource(businessId, "waiters"),
    countResource(businessId, "products"),
  ]);

  return {
    subscription: subscription
      ? {
          id: subscription.id,
          status: subscription.status,
          trialEndsAt: subscription.trialEndsAt,
          endsAt: subscription.endsAt,
          isValid,
          plan: plan && {
            id: plan.id,
            code: plan.code,
            name: plan.name,
            monthlyPrice: Number(plan.monthlyPrice),
          },
        }
      : null,
    usage: {
      tables: { current: tables, limit: plan?.maxTables ?? null },
      waiters: { current: waiters, limit: plan?.maxWaiters ?? null },
      products: { current: products, limit: plan?.maxProducts ?? null },
    },
  };
}

/**
 * Yeni kaynak eklemeden önce çağrılır.
 * Limit aşılmışsa veya abonelik geçersizse hazır bir 402/403 yanıtı döner; uygunsa null.
 */
export async function checkPlanLimit(
  businessId: string,
  resource: LimitedResource
): Promise<NextResponse | null> {
  const { subscription, isValid } = await getCurrentSubscription(businessId);

  if (!subscription || !isValid) {
    return NextResponse.json(
      {
        error: "Aboneliğiniz aktif değil. Devam etmek için planınızı yenileyin.",
        code: "SUBSCRIPTION_INACTIVE",
      },
      { status: 402 }
    );
  }

  const limit =
    resource === "tables"
      ? subscription.plan.maxTables
      : resource === "waiters"
        ? subscription.plan.maxWaiters
        : subscription.plan.maxProducts;

  if (limit === null || limit === undefined) return null;

  const current = await countResource(businessId, resource);
  if (current >= limit) {
    return NextResponse.json(
      {
        error: `${subscription.plan.name} planında en fazla ${limit} ${RESOURCE_LABELS[resource]} ekleyebilirsiniz. Daha fazlası için planınızı yükseltin.`,
        code: "PLAN_LIMIT_REACHED",
        resource,
        current,
        limit,
      },
      { status: 403 }
    );
  }

  return null;
}
