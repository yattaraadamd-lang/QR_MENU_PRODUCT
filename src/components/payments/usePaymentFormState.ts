"use client";

import { useState } from "react";
import { summarizePayment, validatePayment, type PaymentFormValues } from "./paymentForm";
import type { PaymentMethod } from "./paymentMethods";

interface Options {
  /** Açılışta tutar alanı (çoğunlukla kalan borç) */
  readonly initialAmount: string;
  readonly initialMethod?: PaymentMethod;
  /** Reddedilen talebi düzenlerken önceki değerler */
  readonly initialReceived?: string;
  readonly initialNote?: string;
  readonly maxAmount?: number;
}

/**
 * Ödeme formunun alan durumu ve türetilen değerler (para üstü, doğrulama hatası).
 * Gönderim her ekranın kendi ucuna gider; bu hook yalnız formu bilir. Düğme geçersiz
 * değerde kilitlenmez: gönderimde `validationError` FormError'da nedeniyle gösterilir.
 */
export function usePaymentFormState({
  initialAmount,
  initialMethod = "CASH",
  initialReceived = "",
  initialNote = "",
  maxAmount,
}: Options) {
  const [values, setValues] = useState<PaymentFormValues>({
    amount: initialAmount,
    method: initialMethod,
    received: initialMethod === "CASH" ? initialReceived : "",
    note: initialNote,
  });

  const setField = <K extends keyof PaymentFormValues>(key: K, value: PaymentFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  // Nakitten çıkınca alınan tutar sıfırlanır: eski değer sessizce gönderilmesin
  const setMethod = (method: PaymentMethod) =>
    setValues((prev) => ({ ...prev, method, received: method === "CASH" ? prev.received : "" }));

  return {
    values,
    setField,
    setMethod,
    summary: summarizePayment(values),
    validationError: validatePayment(values, { maxAmount }),
    maxAmount,
  };
}

export type PaymentFormState = ReturnType<typeof usePaymentFormState>;
