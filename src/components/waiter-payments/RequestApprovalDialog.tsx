"use client";

import { useId, type FormEvent } from "react";
import { Info } from "lucide-react";
import { useApiMutation } from "@/hooks/useApiMutation";
import PaymentFields from "@/components/payments/PaymentFields";
import PaymentTargetSummary from "@/components/payments/PaymentTargetSummary";
import { toAmountInputValue, toPaymentPayload } from "@/components/payments/paymentForm";
import type { PaymentMethod } from "@/components/payments/paymentMethods";
import { usePaymentFormState } from "@/components/payments/usePaymentFormState";
import { tableDisplayName } from "@/components/tables/tableModel";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import FormError from "@/components/ui/FormError";
import Modal from "@/components/ui/Modal";
import type { WaiterPaymentDTO } from "./types";
import { waiterPaymentsApi } from "./waiterPayments.api";

/** Garson bildiriminde nakit ve kart */
const WAITER_METHODS: readonly PaymentMethod[] = ["CASH", "CARD"];

interface RequestApprovalDialogProps {
  payment: WaiterPaymentDTO;
  onClose: () => void;
  onSent: () => void;
}

/** Garson tahsil ettiği ödemeyi admin onayına gönderir; reddedilen talep önceki değerlerle açılır */
export default function RequestApprovalDialog({ payment, onClose, onSent }: RequestApprovalDialogProps) {
  const due = Number(payment.amount);
  const form = usePaymentFormState({
    initialAmount: toAmountInputValue(due),
    initialMethod: payment.method === "CARD" ? "CARD" : "CASH",
    initialReceived: payment.receivedAmount ? toAmountInputValue(payment.receivedAmount) : "",
    initialNote: payment.note ?? "",
    maxAmount: due,
  });
  const send = useApiMutation(waiterPaymentsApi.requestApproval);
  const formId = useId();
  const close = () => !send.pending && onClose();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (form.validationError) {
      send.setError(form.validationError);
      return;
    }
    const result = await send.run(payment.id, toPaymentPayload(form.values));
    if (result.ok) onSent();
  };

  return (
    <Modal
      onClose={close}
      title="Ödeme Bilgisini Admin Onayına Gönder"
      footer={
        <>
          <Button variant="ghost" className="flex-1" onClick={close}>
            İptal
          </Button>
          <Button type="submit" form={formId} className="flex-[2]" loading={send.pending}>
            {send.pending ? "İletiliyor..." : "Admin Onayına Gönder"}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-3.5" noValidate>
        <PaymentTargetSummary tableName={tableDisplayName(payment.table)} amountLabel="Adisyon / Kalan Borç" amount={due} />
        <PaymentFields form={form} methods={WAITER_METHODS} amountLabel="Tahsil Edilecek Tutar (₺) *" withNote />
        <Alert tone="info" size="sm">
          <span className="flex items-start gap-2">
            <Info aria-hidden="true" className="mt-px size-4 shrink-0" />
            Garson doğrudan ödemeyi tamamlayamaz. Gönderilen bilgiler admin onayından sonra ciroya yansıyacaktır.
          </span>
        </Alert>
        <FormError message={send.error} />
      </form>
    </Modal>
  );
}
