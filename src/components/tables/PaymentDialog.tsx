"use client";

import { useId, type FormEvent } from "react";
import { useApiMutation } from "@/hooks/useApiMutation";
import { formatTRY } from "@/lib/format";
import PaymentFields from "@/components/payments/PaymentFields";
import { toAmountInputValue, toPaymentPayload } from "@/components/payments/paymentForm";
import { ALL_PAYMENT_METHODS } from "@/components/payments/paymentMethods";
import { usePaymentFormState } from "@/components/payments/usePaymentFormState";
import Button from "@/components/ui/Button";
import FormError from "@/components/ui/FormError";
import Modal from "@/components/ui/Modal";
import { tableDisplayName } from "./tableModel";
import { tablesApi } from "./tables.api";
import type { TableBillDTO, TableDTO } from "./types";

interface PaymentDialogProps {
  table: TableDTO;
  sessionId: string;
  /** Kalan borç: tutar alanını önceden doldurur */
  bill: TableBillDTO | null;
  onClose: () => void;
  onPaid: () => void;
}

/** Masadan ödeme al (admin ve garson): tutar, yöntem, nakitte alınan tutar ve para üstü. */
export default function PaymentDialog({ table, sessionId, bill, onClose, onPaid }: PaymentDialogProps) {
  const form = usePaymentFormState({ initialAmount: bill ? toAmountInputValue(bill.remainingAmount) : "" });
  const collect = useApiMutation(tablesApi.collectPayment);
  const formId = useId();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (form.validationError) {
      collect.setError(form.validationError);
      return;
    }
    const result = await collect.run({ tableSessionId: sessionId, ...toPaymentPayload(form.values) });
    if (result.ok) onPaid();
  };

  return (
    <Modal
      onClose={onClose}
      title="💰 Ödeme Al"
      description={
        <>
          {tableDisplayName(table)}
          {bill && <span className="font-bold text-danger-fg"> · Kalan: {formatTRY(bill.remainingAmount)}</span>}
        </>
      }
      footer={
        <>
          <Button
            type="submit"
            form={formId}
            variant="success"
            className="flex-1"
            loading={collect.pending}
          >
            {collect.pending ? "İşleniyor..." : "Ödemeyi Onayla"}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            İptal
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-3.5" noValidate>
        <PaymentFields form={form} methods={ALL_PAYMENT_METHODS} amountLabel="Ödenecek Tutar (₺) *" withNote />
        <FormError message={collect.error} />
      </form>
    </Modal>
  );
}
