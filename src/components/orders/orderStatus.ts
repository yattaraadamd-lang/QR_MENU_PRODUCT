import { AlertTriangle, Check, ChefHat, Clock, UtensilsCrossed, X, type LucideIcon } from "lucide-react";
import type { Tone } from "@/components/ui/tone";
import type { OrderPaymentStatus, OrderStatus } from "./types";

interface StatusMeta {
  readonly label: string;
  readonly tone: Tone;
}

export const ORDER_STATUS: Readonly<Record<OrderStatus, StatusMeta & { readonly Icon: LucideIcon }>> = {
  PENDING: { label: "Bekliyor", tone: "warning", Icon: Clock },
  ACCEPTED: { label: "Kabul Edildi", tone: "info", Icon: Check },
  PREPARING: { label: "Hazırlanıyor", tone: "primary", Icon: ChefHat },
  SERVED: { label: "Servis Edildi", tone: "success", Icon: UtensilsCrossed },
  CANCELLED: { label: "İptal", tone: "danger", Icon: X },
  REJECTED: { label: "Reddedildi", tone: "danger", Icon: AlertTriangle },
};

export function orderStatusMeta(status: OrderStatus) {
  return ORDER_STATUS[status] ?? ORDER_STATUS.PENDING;
}

export const ORDER_PAYMENT_STATUS: Readonly<Record<OrderPaymentStatus, StatusMeta>> = {
  UNPAID: { label: "Ödenmedi", tone: "warning" },
  PAYMENT_REQUESTED: { label: "Ödeme Bekleniyor", tone: "purple" },
  PAID: { label: "Ödendi", tone: "success" },
  CANCELLED: { label: "İptal", tone: "danger" },
};

export const ACTIVE_STATUSES: readonly OrderStatus[] = ["PENDING", "ACCEPTED", "PREPARING"];
export const STOPPED_STATUSES: readonly OrderStatus[] = ["CANCELLED", "REJECTED"];

/** Servis edilmiş, iptal ya da reddedilmiş sipariş artık değişmez */
export function isFinalStatus(status: OrderStatus): boolean {
  return !ACTIVE_STATUSES.includes(status);
}
