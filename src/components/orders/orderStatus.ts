import { AlertTriangle, Check, ChefHat, Clock, UtensilsCrossed, X, type LucideIcon } from "lucide-react";
import { ORDER_STATUS_LABEL as L, type OrderStatusLabel as StatusMeta } from "./orderStatusLabel";
import type { OrderPaymentStatus, OrderStatus } from "./types";

export const ORDER_STATUS: Readonly<Record<OrderStatus, StatusMeta & { readonly Icon: LucideIcon }>> = {
  PENDING: { ...L.PENDING, Icon: Clock },
  ACCEPTED: { ...L.ACCEPTED, Icon: Check },
  PREPARING: { ...L.PREPARING, Icon: ChefHat },
  SERVED: { ...L.SERVED, Icon: UtensilsCrossed },
  CANCELLED: { ...L.CANCELLED, Icon: X },
  REJECTED: { ...L.REJECTED, Icon: AlertTriangle },
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
