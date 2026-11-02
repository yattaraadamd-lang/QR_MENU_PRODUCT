import { formatTRY } from "@/lib/format";
import type { PaymentMethod } from "./paymentMethods";

/** Ödeme alma formu (masa detayı ve açık adisyon tahsilatı ortak): saf tipler ve kurallar */

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

export interface PaymentPayload {
  readonly amount: number;
  readonly method: PaymentMethod;
  /** Yalnız nakitte; para üstü sunucuda hesaplanır */
  readonly receivedAmount: number | null;
  readonly note: string | null;
}

interface ValidationOptions {
  /** Kalan borç: tahsilat bunu aşamaz */
  readonly maxAmount?: number;
}

export function validatePayment(values: PaymentFormValues, { maxAmount }: ValidationOptions = {}): string | null {
  const amount = parseFloat(values.amount);
  if (!Number.isFinite(amount) || amount <= 0) return "Geçerli bir ödeme tutarı girin.";
  if (maxAmount !== undefined && amount > maxAmount) return "Ödenen tutar kalan tutardan büyük olamaz.";
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

/** Doğrulanmış formdan istek gövdesi */
export function toPaymentPayload(values: PaymentFormValues): PaymentPayload {
  return {
    amount: parseFloat(values.amount),
    method: values.method,
    receivedAmount: values.method === "CASH" ? parseFloat(values.received) : null,
    note: values.note.trim() || null,
  };
}

/** "Ödeme alındı. Para üstü: ₺10,00" — para üstü yalnız nakitte ve sıfırdan büyükse */
export function paymentSuccessMessage(base: string, method: string | null, changeAmount: unknown): string {
  const change = Number(changeAmount);
  return method === "CASH" && change > 0 ? `${base} Para üstü: ${formatTRY(change)}` : base;
}

/** Tutar alanının değeri: type="number" "12.50" bekler (ekranda formatTRY) */
export function toAmountInputValue(value: number | string): string {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : "";
}
