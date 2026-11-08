"use client";

import { useRef, useState, type FormEvent } from "react";
import { subscriptionApi } from "./subscription.api";
import type { BillingCustomer, PlanDTO } from "@/components/subscription/types";

const EMPTY_CUSTOMER: BillingCustomer = { name: "", surname: "", gsmNumber: "", identityNumber: "", city: "", address: "" };

/**
 * iyzico ödeme akışı: fatura bilgisi → sunucu ödeme formunu başlatır → dönen <script>'ler
 * `hostRef`'e eklenir. innerHTML betik çalıştırmadığı için her betik yeniden oluşturulur.
 */
export function useCheckout(plan: PlanDTO, onReady: () => void) {
  const [customer, setCustomer] = useState<BillingCustomer>(EMPTY_CUSTOMER);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [ready, setReady] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);

  const setField = (key: keyof BillingCustomer, value: string) => setCustomer((prev) => ({ ...prev, [key]: value }));

  const mountCheckoutForm = (html: string) => {
    // Form kabı `ready` ile çizilir; betikler bir sonraki karede eklenir
    requestAnimationFrame(() => {
      const tmp = document.createElement("div");
      tmp.innerHTML = html;
      tmp.querySelectorAll("script").forEach((old) => {
        const script = document.createElement("script");
        if (old.src) script.src = old.src;
        script.text = old.text;
        hostRef.current?.appendChild(script);
      });
    });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!plan.code) return;
    setError(null);
    setSubmitting(true);
    const result = await subscriptionApi.startCheckout(plan.code, customer);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setReady(true);
    onReady();
    mountCheckoutForm(result.data.checkoutFormContent);
  };

  return { customer, setField, error, submitting, ready, hostRef, submit };
}
