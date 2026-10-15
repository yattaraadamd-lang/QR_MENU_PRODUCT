/**
 * iyzico ↔ BusinessSubscription senkronizasyonu
 */

import { prisma } from "./prisma";
import { getSubscription, mapIyzicoStatus, IyzicoSubscription } from "./iyzico";

/** Başarılı ödeme formundan sonra aboneliği aktif eder; önceki deneme/aboneliği kapatır. */
export async function activateIyzicoSubscription(
  businessId: string,
  planId: string,
  iyzi: IyzicoSubscription
) {
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
  if (!plan || plan.iyzicoPricingPlanRef !== iyzi.pricingPlanReferenceCode) {
    throw new Error("Ödeme planı eşleşmiyor");
  }

  // Aynı iyzico aboneliği ikinci kez işlenmez (callback tekrarı)
  const existing = await prisma.businessSubscription.findUnique({
    where: { iyzicoSubscriptionRef: iyzi.referenceCode },
  });
  if (existing) return existing;

  const now = new Date();
  return prisma.$transaction(async (tx) => {
    await tx.businessSubscription.updateMany({
      where: { businessId, status: { in: ["TRIAL", "ACTIVE", "PAST_DUE"] } },
      data: { status: "CANCELLED", endsAt: now },
    });

    return tx.businessSubscription.create({
      data: {
        businessId,
        planId,
        status: mapIyzicoStatus(iyzi.subscriptionStatus),
        startedAt: iyzi.startDate ? new Date(iyzi.startDate) : now,
        iyzicoSubscriptionRef: iyzi.referenceCode,
        iyzicoCustomerRef: iyzi.customerReferenceCode,
      },
    });
  });
}

/** Webhook sonrası: durumu iyzico'dan okuyup yerel kaydı günceller. */
export async function syncIyzicoSubscription(referenceCode: string) {
  const local = await prisma.businessSubscription.findUnique({
    where: { iyzicoSubscriptionRef: referenceCode },
  });
  if (!local) return null;

  const remote = await getSubscription(referenceCode);
  const status = mapIyzicoStatus(remote.subscriptionStatus);

  return prisma.businessSubscription.update({
    where: { id: local.id },
    data: {
      status,
      endsAt: status === "ACTIVE" ? null : remote.endDate ? new Date(remote.endDate) : new Date(),
    },
  });
}
