import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { SUBSCRIPTION_STATUS, trialDaysLeft } from "./subscriptionModel";
import type { SubscriptionData } from "./types";
import UsageMeter from "./UsageMeter";

interface CurrentPlanCardProps {
  data: SubscriptionData;
  now: number;
  onCancel: () => void;
}

/** Mevcut plan, durum, deneme süresi ve kullanım göstergeleri */
export default function CurrentPlanCard({ data, now, onCancel }: CurrentPlanCardProps) {
  const sub = data.subscription;
  const status = sub ? SUBSCRIPTION_STATUS[sub.status] : null;
  const daysLeft = trialDaysLeft(sub, now);

  return (
    <section aria-labelledby="current-plan-heading" className="card max-w-3xl p-5">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-fg-secondary">Mevcut plan</p>
          <h2 id="current-plan-heading" className="text-xl font-extrabold text-fg">
            {sub?.plan?.name ?? "Plan yok"}
          </h2>
          {daysLeft !== null && (
            <p className="mt-1 text-sm text-fg-secondary">
              Deneme süresinin bitmesine <strong>{daysLeft} gün</strong> kaldı
            </p>
          )}
          {sub && !sub.isValid && (
            <p className="mt-1 text-sm text-danger-fg">
              Aboneliğiniz aktif değil — yeni masa, ürün veya garson ekleyemezsiniz.
            </p>
          )}
        </div>
        {status && <Badge tone={status.tone}>{status.label}</Badge>}
      </div>

      <div className="grid gap-3.5">
        <UsageMeter label="Masalar" usage={data.usage.tables} />
        <UsageMeter label="Garsonlar" usage={data.usage.waiters} />
        <UsageMeter label="Ürünler" usage={data.usage.products} />
      </div>

      {sub?.status === "ACTIVE" && (
        <Button variant="danger-ghost" size="sm" className="mt-5" onClick={onCancel}>
          Aboneliği iptal et
        </Button>
      )}
    </section>
  );
}
