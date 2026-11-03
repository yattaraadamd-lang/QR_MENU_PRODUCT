import type { Tone } from "@/components/ui/tone";
import type { PlanDTO, SubscriptionDTO, SubscriptionStatus, UsageDTO } from "./types";

export const SUBSCRIPTION_STATUS: Readonly<Record<SubscriptionStatus, { label: string; tone: Tone }>> = {
  TRIAL: { label: "Deneme", tone: "info" },
  ACTIVE: { label: "Aktif", tone: "success" },
  PAST_DUE: { label: "Ödeme Bekleniyor", tone: "warning" },
  CANCELLED: { label: "İptal Edildi", tone: "danger" },
  EXPIRED: { label: "Süresi Doldu", tone: "danger" },
};

export function formatLimit(limit: number | null): string {
  return limit === null ? "Sınırsız" : String(limit);
}

/** Uyarı eşikleri: %80'de dikkat, sınırda dolu */
const WARN_RATIO = 0.8;
const MS_PER_DAY = 86_400_000;

export interface UsageLevel {
  /** 0–100; sınırsızda 0 */
  readonly percent: number;
  readonly tone: "primary" | "warning" | "danger";
}

export function usageLevel(usage: UsageDTO): UsageLevel {
  if (!usage.limit) return { percent: 0, tone: "primary" };
  const ratio = Math.min(1, usage.current / usage.limit);
  const tone = ratio >= 1 ? "danger" : ratio >= WARN_RATIO ? "warning" : "primary";
  return { percent: Math.round(ratio * 100), tone };
}

/** Deneme bitimine kalan gün (yalnız denemede) */
export function trialDaysLeft(subscription: SubscriptionDTO | null, now: number): number | null {
  if (subscription?.status !== "TRIAL" || !subscription.trialEndsAt) return null;
  return Math.max(0, Math.ceil((new Date(subscription.trialEndsAt).getTime() - now) / MS_PER_DAY));
}

/** Plan kartındaki düğme: mevcut plan / yakında / seç */
export function planAction(plan: PlanDTO, subscription: SubscriptionDTO | null, checkoutStarted: boolean) {
  const isCurrent = subscription?.status === "ACTIVE" && subscription.plan?.code === plan.code;
  if (isCurrent) return { label: "Mevcut plan", disabled: true };
  if (!plan.canPurchase) return { label: "Yakında", disabled: true };
  return { label: "Bu planı seç", disabled: checkoutStarted };
}
