"use client";

import { useId, useState, type FormEvent } from "react";
import { useApiMutation } from "@/hooks/useApiMutation";
import { tableDisplayName } from "@/components/tables/tableModel";
import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";
import FormError from "@/components/ui/FormError";
import Modal from "@/components/ui/Modal";
import { pendingPaymentsApi } from "./pendingPayments.api";
import type { PaymentRequestDTO } from "./types";

interface RejectRequestDialogProps {
  request: PaymentRequestDTO;
  onClose: () => void;
  onRejected: (message: string) => void;
}

export default function RejectRequestDialog({ request, onClose, onRejected }: RejectRequestDialogProps) {
  const [reason, setReason] = useState("");
  const reject = useApiMutation(pendingPaymentsApi.reject);
  const formId = useId();
  // İstek sürerken pencere kapanmaz: sonuç kaybolmasın
  const close = () => !reject.pending && onClose();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = await reject.run(request.id, reason);
    if (result.ok) onRejected("Ödeme talebi reddedildi.");
  };

  return (
    <Modal
      onClose={close}
      title="Ödeme Talebini Reddet"
      description={`${tableDisplayName(request.table)} ödeme talebini reddetmek üzeresiniz.`}
      footer={
        <>
          <Button variant="ghost" className="flex-1" onClick={close}>
            İptal
          </Button>
          <Button type="submit" form={formId} variant="danger" className="flex-1" loading={reject.pending}>
            {reject.pending ? "İşleniyor..." : "Reddet"}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field label="Red Nedeni" htmlFor={`${formId}-reason`}>
          <input
            id={`${formId}-reason`}
            className="input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Örn: Tutar hatalı veya eksik"
            maxLength={500}
            data-autofocus
          />
        </Field>
        <FormError message={reject.error} />
      </form>
    </Modal>
  );
}
