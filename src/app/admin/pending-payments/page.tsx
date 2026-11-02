"use client";

import { lazy, Suspense } from "react";
import { Clock } from "lucide-react";
import ApprovalRequestCard from "@/components/pending-payments/ApprovalRequestCard";
import OpenBillCard from "@/components/pending-payments/OpenBillCard";
import PaymentSection from "@/components/pending-payments/PaymentSection";
import { usePendingPaymentsPage } from "@/components/pending-payments/usePendingPaymentsPage";
import Alert from "@/components/ui/Alert";

// Yalnız tıklamayla açılan pencereler: ilk yük paketinin dışında (SSR'da hiç çizilmez)
const RejectRequestDialog = lazy(() => import("@/components/pending-payments/RejectRequestDialog"));
const BillPaymentDialog = lazy(() => import("@/components/pending-payments/BillPaymentDialog"));

export default function PendingPaymentsPage() {
  const page = usePendingPaymentsPage();
  const { requests, bills, dialog } = page;
  const requestList = requests.data ?? [];
  const billList = bills.data ?? [];

  return (
    <div>
      <header className="mb-6">
        <h1 className="page-title mb-2">Admin Ödeme Onayları & Bekleyen Adisyonlar</h1>
        <p className="text-fg-secondary">
          Garsonlardan gelen ödeme bildirimlerini onaylayın veya açık adisyonlardan tahsilat yapın.
        </p>
      </header>

      {page.approveError && (
        <Alert tone="danger" role="alert" className="mb-4 font-semibold">
          ⚠️ {page.approveError}
        </Alert>
      )}

      <PaymentSection
        title={`Garson / Müşteri Ödeme Onay Talepleri (${requestList.length})`}
        icon={<Clock aria-hidden="true" className="size-5 text-warning-fg" />}
        query={requests}
        count={requestList.length}
        empty={{ icon: "✅", title: "Onay bekleyen ödeme talebi yok." }}
      >
        {requestList.map((request) => (
          <ApprovalRequestCard
            key={request.id}
            request={request}
            approving={page.approvingId === request.id}
            onApprove={page.approveRequest}
            onReject={page.openReject}
          />
        ))}
      </PaymentSection>

      <PaymentSection
        title="Açık Adisyonlar (Doğrudan Tahsilat)"
        query={bills}
        count={billList.length}
        empty={{ icon: "🧾", title: "Bekleyen açık adisyon bulunmamaktadır." }}
      >
        {billList.map((bill) => (
          <OpenBillCard key={bill.id} bill={bill} onPay={page.openPay} />
        ))}
      </PaymentSection>

      <Suspense fallback={null}>
        {dialog.kind === "reject" && (
          <RejectRequestDialog request={dialog.request} onClose={page.closeDialog} onRejected={page.finishDialog} />
        )}
        {dialog.kind === "pay" && (
          <BillPaymentDialog bill={dialog.bill} onClose={page.closeDialog} onPaid={page.finishDialog} />
        )}
      </Suspense>
    </div>
  );
}
