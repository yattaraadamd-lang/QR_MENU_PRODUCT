"use client";

import { useId, useState, type FormEvent } from "react";
import { useApiMutation } from "@/hooks/useApiMutation";
import { randomId } from "@/lib/uuid";
import PaymentFields from "@/components/payments/PaymentFields";
import PaymentTargetSummary from "@/components/payments/PaymentTargetSummary";
import { paymentSuccessMessage, toAmountInputValue, toPaymentPayload } from "@/components/payments/paymentForm";
import type { PaymentMethod } from "@/components/payments/paymentMethods";
import { usePaymentFormState } from "@/components/payments/usePaymentFormState";
import { tableDisplayName } from "@/components/tables/tableModel";
import Button from "@/components/ui/Button";
import FormError from "@/components/ui/FormError";
import Modal from "@/components/ui/Modal";
import { pendingPaymentsApi } from "./pendingPayments.api";
import type { OpenBillDTO } from "./types";

/** Admin doğrudan tahsilatta yalnız kart ve nakit alır */
const BILL_PAYMENT_METHODS: readonly PaymentMethod[] = ["CARD", "CASH"];

interface BillPaymentDialogProps {
  bill: OpenBillDTO;
  onClose: () => void;
  onPaid: (message: string) => void;
}

/** Açık adisyondan doğrudan tahsilat: kalan borcu aşamaz, nakitte para üstü gösterilir */
export default function BillPaymentDialog({ bill, onClose, onPaid }: BillPaymentDialogProps) {
  const remaining = Number(bill.remainingAmount);
  const form = usePaymentFormState({
    initialAmount: toAmountInputValue(remaining),
    initialMethod: "CARD",
    maxAmount: remaining,
  });
  const pay = useApiMutation(pendingPaymentsApi.payBill);
  // Pencere başına tek anahtar: aynı tahsilatın yeniden denenmesi çift kayıt açmaz
  const [idempotencyKey] = useState(randomId);
  const formId = useId();
  const close = () => !pay.pending && onClose();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (form.validationError) {
      pay.setError(form.validationError);
      return;
    }
    const result = await pay.run(bill.id, toPaymentPayload(form.values), idempotencyKey);
    if (result.ok) {
      onPaid(paymentSuccessMessage("Ödeme başarıyla alındı.", form.values.method, result.data.changeAmount));
    }
  };

  return (
    <Modal
      onClose={close}
      title="Ödeme Al"
      footer={
        <Button
          type="submit"
          form={formId}
          size="lg"
          className="w-full"
          loading={pay.pending}
        >
          {pay.pending ? "İşleniyor..." : "Ödemeyi Tamamla"}
        </Button>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-3.5" noValidate>
        <PaymentTargetSummary tableName={tableDisplayName(bill.table)} amountLabel="Kalan Hesap" amount={remaining} />
        <PaymentFields form={form} methods={BILL_PAYMENT_METHODS} amountLabel="Borçtan Tahsil Edilecek Tutar (₺) *" />
        <FormError message={pay.error} />
      </form>
    </Modal>
  );
}
