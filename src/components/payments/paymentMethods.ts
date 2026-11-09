import type { ChoiceOption } from "@/components/ui/ChoiceGroup";
import type { PaymentMethod } from "@/contracts/payments";

/**
 * Ödeme yöntemleri ve etiketleri. Form mantığından (paymentForm.ts) ayrı: liste/detay ekranları
 * yalnız etiketi kullanır, doğrulama kodu ilk yük paketine girmesin.
 */

export type { PaymentMethod };

const PAYMENT_METHOD_LABEL: Readonly<Record<PaymentMethod, string>> = {
  CASH: "💵 Nakit",
  CARD: "💳 Kart",
  ONLINE: "📱 Havale/EFT",
  OTHER: "🔄 Diğer",
};

export const ALL_PAYMENT_METHODS: readonly PaymentMethod[] = ["CASH", "CARD", "ONLINE", "OTHER"];

export function paymentMethodOptions(methods: readonly PaymentMethod[]): ChoiceOption<PaymentMethod>[] {
  return methods.map((value) => ({ value, label: PAYMENT_METHOD_LABEL[value] }));
}

export function paymentMethodLabel(method: string | null): string {
  if (!method) return "—";
  return PAYMENT_METHOD_LABEL[method as PaymentMethod] ?? method;
}
