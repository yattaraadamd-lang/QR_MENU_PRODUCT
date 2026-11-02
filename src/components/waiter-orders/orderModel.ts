import { Check, ChefHat, UtensilsCrossed, type LucideIcon } from "lucide-react";
import type { OrderStatus } from "@/components/orders/types";

/** Garsonun bir sonraki adımı: durum → { hedef, düğme etiketi, başarı mesajı } */
export interface OrderStep {
  readonly next: OrderStatus;
  readonly label: string;
  readonly success: string;
  readonly variant: "success" | "primary";
  readonly Icon: LucideIcon;
}

const NEXT_STEP: Partial<Record<OrderStatus, OrderStep>> = {
  PENDING: { next: "ACCEPTED", label: "Kabul Et", success: "Sipariş kabul edildi", variant: "success", Icon: Check },
  ACCEPTED: { next: "PREPARING", label: "Hazırlanıyor", success: "Hazırlanmaya başlandı", variant: "primary", Icon: ChefHat },
  PREPARING: { next: "SERVED", label: "Servis Edildi", success: "Servis edildi", variant: "success", Icon: UtensilsCrossed },
};

export function nextOrderStep(status: OrderStatus): OrderStep | null {
  return NEXT_STEP[status] ?? null;
}

/** Bekleyen sipariş reddedilir; kabul edilmiş/hazırlanan iptal edilir */
export function stopStatusFor(status: OrderStatus): "REJECTED" | "CANCELLED" | null {
  if (status === "PENDING") return "REJECTED";
  if (status === "ACCEPTED" || status === "PREPARING") return "CANCELLED";
  return null;
}
