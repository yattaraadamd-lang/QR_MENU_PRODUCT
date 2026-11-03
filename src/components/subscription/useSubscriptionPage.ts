"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { useApiQuery } from "@/hooks/useApiQuery";
import { useConfirm } from "@/components/ui/useConfirm";
import { selectSubscription, subscriptionApi, SUBSCRIPTION_URL } from "./subscription.api";
import type { PlanDTO } from "./types";

/** Abonelik: mevcut plan + kullanım, planlar, ödeme için seçilen plan, ücretli aboneliği iptal */
export function useSubscriptionPage() {
  const { data: session } = useSession();
  const query = useApiQuery(session?.user.businessId ? SUBSCRIPTION_URL : null, { select: selectSubscription });
  const [selectedPlan, setSelectedPlan] = useState<PlanDTO | null>(null);
  const [checkoutStarted, setCheckoutStarted] = useState(false);
  const [confirm, confirmDialog] = useConfirm();

  const cancelPaid = async () => {
    const ok = await confirm({
      title: "Ücretli abonelik iptal edilsin mi?",
      description: "Ücretli aboneliğiniz iptal edilecek.",
      confirmText: "Aboneliği iptal et",
    });
    if (!ok) return;
    const result = await subscriptionApi.cancelPaid();
    if (result.ok) toast.success(result.data.message || "Abonelik iptal edildi");
    else if (!result.aborted) toast.error(result.error);
    void query.refresh();
  };

  return {
    query,
    data: query.data ?? null,
    selectedPlan,
    selectPlan: setSelectedPlan,
    clearPlan: () => setSelectedPlan(null),
    checkoutStarted,
    markCheckoutStarted: () => setCheckoutStarted(true),
    cancelPaid,
    confirmDialog,
  };
}
