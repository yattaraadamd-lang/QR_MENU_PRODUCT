"use client";

import { useCallback, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { useApiMutation } from "@/hooks/useApiMutation";
import { useApiQuery } from "@/hooks/useApiQuery";
import { useBusinessSocket } from "@/hooks/useBusinessSocket";
import { paymentSuccessMessage } from "@/components/payments/paymentForm";
import { pendingPaymentsApi, selectApprovalRequests, selectOpenBills } from "./pendingPayments.api";
import type { OpenBillDTO, PaymentRequestDTO } from "./types";

/** Sekme görünürken yenileme aralığı; ödeme olayları ayrıca soketle anında gelir */
const REFRESH_MS = 6000;
const PAYMENT_EVENTS = ["payment_request", "payment_collected"];

type PendingDialog =
  | { readonly kind: "none" }
  | { readonly kind: "reject"; readonly request: PaymentRequestDTO }
  | { readonly kind: "pay"; readonly bill: OpenBillDTO };

const NO_DIALOG: PendingDialog = { kind: "none" };

/** Bekleyen ödemeler ekranının verisi ve eylemleri; sayfa yalnız çizim yapar */
export function usePendingPaymentsPage() {
  const { data: session } = useSession();
  const ready = Boolean(session?.user.businessId);

  const requests = useApiQuery(ready ? "/api/admin/payments" : null, {
    select: selectApprovalRequests,
    refreshInterval: REFRESH_MS,
  });
  const bills = useApiQuery(ready ? "/api/admin/pending-payments" : null, {
    select: selectOpenBills,
    refreshInterval: REFRESH_MS,
  });

  const refreshRequests = requests.refresh;
  const refreshBills = bills.refresh;
  const refreshAll = useCallback(() => {
    void refreshRequests();
    void refreshBills();
  }, [refreshRequests, refreshBills]);
  useBusinessSocket(PAYMENT_EVENTS, refreshAll);

  const approve = useApiMutation(pendingPaymentsApi.approve);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<PendingDialog>(NO_DIALOG);

  // Pencere açık değil: hata sayfadaki uyarıda, başarı toast'ta
  const approveRequest = async (request: PaymentRequestDTO) => {
    setApprovingId(request.id);
    const result = await approve.run(request);
    setApprovingId(null);
    if (!result.ok) return;
    toast.success(paymentSuccessMessage("Ödeme onaylandı ve tahsil edildi.", request.method, result.data.changeAmount));
    refreshAll();
  };

  const finishDialog = (message: string) => {
    setDialog(NO_DIALOG);
    toast.success(message);
    refreshAll();
  };

  return {
    requests,
    bills,
    approvingId,
    approveError: approve.error,
    approveRequest,
    dialog,
    openReject: (request: PaymentRequestDTO) => setDialog({ kind: "reject", request }),
    openPay: (bill: OpenBillDTO) => setDialog({ kind: "pay", bill }),
    closeDialog: () => setDialog(NO_DIALOG),
    finishDialog,
  };
}
