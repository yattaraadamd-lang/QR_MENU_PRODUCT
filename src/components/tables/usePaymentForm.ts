"use client";

import { useState } from "react";
import { useApiMutation } from "@/hooks/useApiMutation";
import { formatTRY } from "@/lib/format";
import { tablesApi } from "./tables.api";
import type { PaymentMethod } from "./types";

export interface PaymentFormValues {
  readonly amount: string;
  readonly method: PaymentMethod;
  /** Nakitte müşteriden alınan tutar */
  readonly received: string;
  readonly note: string;
}

export interface PaymentSummary {
  readonly due: number;
  readonly received: number;
  /** Negatifse alınan nakit yetersiz */
  readonly change: number;
}

/** Saf doğrulama: gönderimden önce ve düğmenin etkinliği için */
export function validatePayment(values: PaymentFormValues): string | null {
  const amount = parseFloat(values.amount);
  if (!Number.isFinite(amount) || amount <= 0) return "Geçerli bir ödeme tutarı girin.";
  if (values.method !== "CASH") return null;

  const received = parseFloat(values.received);
  if (!Number.isFinite(received) || received <= 0) return "Müşteriden alınan nakit tutarını girin.";
  if (received < amount) {
    return `Alınan nakit (${formatTRY(received)}) ödeme tutarından (${formatTRY(amount)}) az olamaz.`;
  }
  return null;
}

export function summarizePayment(values: PaymentFormValues): PaymentSummary {
  const due = parseFloat(values.amount) || 0;
  const received = values.method === "CASH" ? parseFloat(values.received) || 0 : 0;
  return { due, received, change: received - due };
}

interface Options {
  readonly sessionId: string;
  /** Açılışta tutar alanı (kalan borç) */
  readonly initialAmount: string;
  readonly onPaid: () => void;
}

/** Ödeme alma formu: alan durumu, para üstü özeti, doğrulama ve gönderim. */
export function usePaymentForm({ sessionId, initialAmount, onPaid }: Options) {
  const [values, setValues] = useState<PaymentFormValues>({
    amount: initialAmount,
    method: "CASH",
    received: "",
    note: "",
  });
  const mutation = useApiMutation(tablesApi.collectPayment);

  const setField = <K extends keyof PaymentFormValues>(key: K, value: PaymentFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  // Nakitten çıkınca alınan tutar sıfırlanır: eski değer sessizce gönderilmesin
  const setMethod = (method: PaymentMethod) =>
    setValues((prev) => ({ ...prev, method, received: method === "CASH" ? prev.received : "" }));

  const validationError = validatePayment(values);

  const submit = async () => {
    if (validationError) {
      mutation.setError(validationError);
      return;
    }
    const isCash = values.method === "CASH";
    const result = await mutation.run({
      tableSessionId: sessionId,
      amount: parseFloat(values.amount),
      method: values.method,
      receivedAmount: isCash ? parseFloat(values.received) : null,
      note: values.note.trim() || null,
    });
    if (result.ok) onPaid();
  };

  return {
    values,
    setField,
    setMethod,
    summary: summarizePayment(values),
    canSubmit: !mutation.pending && validationError === null,
    pending: mutation.pending,
    error: mutation.error,
    submit,
  };
}
