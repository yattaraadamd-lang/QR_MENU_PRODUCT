/**
 * iyzico ↔ BusinessSubscription senkronizasyonu
 */

import "server-only";
import type { BusinessSubscription } from "@prisma/client";
import { logger } from "./logger";
import { prisma } from "./prisma";
import { cancelSubscription, getSubscription, mapIyzicoStatus, IyzicoSubscription } from "./iyzico";

/** startedAt'tan itibaren aylık dönemlerin now'dan sonraki ilk sınırı. Kısa ayda ayın son gününe düşer */
export function nextBillingDate(startedAt: Date, now: Date): Date {
  const monthsApart =
    (now.getUTCFullYear() - startedAt.getUTCFullYear()) * 12 + (now.getUTCMonth() - startedAt.getUTCMonth());
  for (let months = Math.max(monthsApart, 1); ; months++) {
    const year = startedAt.getUTCFullYear();
    const month = startedAt.getUTCMonth() + months;
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const candidate = new Date(startedAt);
    candidate.setUTCFullYear(year, month, Math.min(startedAt.getUTCDate(), lastDay));
    if (candidate > now) return candidate;
  }
}

/**
 * Sona eren aboneliğin hakkı ne zaman biter (Kullanım Koşulları madde 5.6: ödenmiş dönemin sonu).
 * iyzico'nun endDate alanı kullanılmaz: belgeler iptal sonrası anlamını tanımlamıyor. Kaynak, ödemesi
 * alınmış dönemlerin sonu. Dönem bilgisi gelmezse aktif abone hakkını kaybetmesin diye sonraki aylık
 * sınır alınır; ödemesi gecikmiş abonelik için ödenmiş dönem yoktur.
 */
export function subscriptionEndDate(
  remote: Pick<IyzicoSubscription, "orders"> | null,
  local: Pick<BusinessSubscription, "status" | "startedAt">,
  now: Date
): Date {
  const orders = remote?.orders;
  if (orders?.length) {
    const paidUntil = orders
      .filter((order) => order.orderStatus === "SUCCESS" && typeof order.endPeriod === "number")
      .map((order) => order.endPeriod as number);
    return paidUntil.length ? new Date(Math.max(...paidUntil)) : now;
  }
  return local.status === "ACTIVE" ? nextBillingDate(local.startedAt, now) : now;
}

/**
 * Yöneticinin iptali: yenileme durur, hak ödenmiş dönemin sonuna kadar sürer. Durum iyzico'dan
 * okunamasa da yerel kayıt iptal edilir: tahsilat durdu, ekran hâlâ "Aktif" demesin.
 */
export async function cancelPaidSubscription(local: BusinessSubscription) {
  if (!local.iyzicoSubscriptionRef) throw new Error("iyzico aboneliği olmayan kayıt iptal edilemez");
  await cancelSubscription(local.iyzicoSubscriptionRef);
  const remote = await getSubscription(local.iyzicoSubscriptionRef).catch((error: unknown) => {
    // Yutulmaz: bitiş tarihi yerel kayıttan hesaplanır, okuma hatası loga düşer
    logger.warn({ err: error, subscriptionId: local.id }, "[billing] İptal sonrası iyzico durumu okunamadı");
    return null;
  });
  return prisma.businessSubscription.update({
    where: { id: local.id },
    data: { status: "CANCELLED", endsAt: subscriptionEndDate(remote, local, new Date()) },
  });
}

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
  const ended = status === "CANCELLED" || status === "EXPIRED";

  // Bitiş bir kez yazılır: geç gelen ya da tekrarlanan bildirim hak süresini uzatmasın
  const alreadyEnded = (local.status === "CANCELLED" || local.status === "EXPIRED") && local.endsAt;
  if (ended && alreadyEnded) return local;

  const now = new Date();
  return prisma.businessSubscription.update({
    where: { id: local.id },
    data: {
      status,
      endsAt: ended
        ? subscriptionEndDate(remote, local, now)
        : status === "ACTIVE"
          ? null
          : remote.endDate
            ? new Date(remote.endDate)
            : now,
    },
  });
}
