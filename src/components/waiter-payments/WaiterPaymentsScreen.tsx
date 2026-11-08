"use client";

import { lazy, Suspense } from "react";
import { CreditCard } from "lucide-react";
import { useWaiterPaymentsPage } from "@/components/waiter-payments/useWaiterPaymentsPage";
import WaiterPaymentCard from "@/components/waiter-payments/WaiterPaymentCard";
import EmptyState from "@/components/ui/EmptyState";
import QueryError from "@/components/ui/QueryError";
import Skeleton from "@/components/ui/Skeleton";

// Yalnız tıklamayla açılır: ilk yük paketinin dışında (SSR'da hiç çizilmez)
const RequestApprovalDialog = lazy(() => import("@/components/waiter-payments/RequestApprovalDialog"));

const SKELETON_COUNT = 3;

export default function WaiterPaymentsScreen() {
  const { query, payments, selected, open, close, handleSent } = useWaiterPaymentsPage();

  return (
    <div>
      <h1 className="page-title page-title-sm mb-4">Ödeme Talepleri ve Garson Bildirimleri</h1>

      <QueryError message={query.error} onRetry={query.refresh} />

      {query.isLoading && (
        <div role="status" aria-label="Ödeme talepleri yükleniyor" className="flex flex-col gap-2.5">
          {Array.from({ length: SKELETON_COUNT }, (_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      )}

      {!query.isLoading && payments.length === 0 && !query.error && (
        <EmptyState
          icon={<CreditCard className="mx-auto size-12 text-fg-muted" strokeWidth={1.5} />}
          title="Bekleyen ödeme talebi yok"
          description="Müşteri hesap istediğinde talep burada belirir."
        />
      )}

      {payments.length > 0 && (
        <ul aria-label="Ödeme talepleri" className="stagger flex flex-col gap-3">
          {payments.map((payment) => (
            <WaiterPaymentCard key={payment.id} payment={payment} onSend={open} />
          ))}
        </ul>
      )}

      <Suspense fallback={null}>
        {selected && <RequestApprovalDialog payment={selected} onClose={close} onSent={handleSent} />}
      </Suspense>
    </div>
  );
}
