"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useNow } from "@/hooks/useNow";
import CheckoutPanel from "@/components/subscription/CheckoutPanel";
import CurrentPlanCard from "@/components/subscription/CurrentPlanCard";
import PlanCard from "@/components/subscription/PlanCard";
import { planAction } from "@/components/subscription/subscriptionModel";
import { useSubscriptionPage } from "@/components/subscription/useSubscriptionPage";
import Alert from "@/components/ui/Alert";
import Loader from "@/components/ui/Loader";
import QueryError from "@/components/ui/QueryError";

/** Deneme gün sayısı için saatlik tazeleme yeter */
const CLOCK_TICK_MS = 3_600_000;

/** iyzico dönüşü: ?payment=success|failed */
function PaymentResultBanner() {
  const result = useSearchParams().get("payment");
  if (result === "success") {
    return (
      <Alert tone="success" role="status" className="mb-4">
        ✅ Ödemeniz alındı, aboneliğiniz aktif.
      </Alert>
    );
  }
  if (result === "failed") {
    return (
      <Alert tone="danger" role="alert" className="mb-4">
        ❌ Ödeme tamamlanamadı. Lütfen tekrar deneyin.
      </Alert>
    );
  }
  return null;
}

export default function AdminSubscriptionScreen() {
  const page = useSubscriptionPage();
  const { query, data, selectedPlan } = page;
  const now = useNow(CLOCK_TICK_MS);

  return (
    <div>
      <h1 className="page-title mb-6">Abonelik</h1>

      {/* useSearchParams yalnız bu küçük bileşeni istemciye bağlar; sayfanın geri kalanı beklemez */}
      <Suspense fallback={null}>
        <PaymentResultBanner />
      </Suspense>

      <QueryError message={query.error} onRetry={query.refresh} />
      {query.isLoading && <Loader label="Abonelik yükleniyor" />}
      {!query.isLoading && !data && !query.error && (
        <p className="p-8 text-center text-danger-fg">Abonelik bilgisi alınamadı.</p>
      )}

      {data && (
        <div className="flex flex-col gap-6">
          <CurrentPlanCard data={data} now={now} onCancel={page.cancelPaid} />

          <section aria-labelledby="plans-heading">
            <h2 id="plans-heading" className="mb-3 text-lg font-bold text-fg">
              Planlar
            </h2>
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(13.75rem,100%),1fr))] gap-3">
              {data.plans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  selected={selectedPlan?.id === plan.id}
                  action={planAction(plan, data.subscription, page.checkoutStarted)}
                  onSelect={page.selectPlan}
                />
              ))}
            </ul>
          </section>

          {selectedPlan && (
            <CheckoutPanel
              key={selectedPlan.id}
              plan={selectedPlan}
              onCancel={page.clearPlan}
              onStarted={page.markCheckoutStarted}
            />
          )}
        </div>
      )}

      {page.confirmDialog}
    </div>
  );
}
