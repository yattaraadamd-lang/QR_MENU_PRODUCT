import type { Tone } from "@/components/ui/tone";
import type { OrderStatus } from "./types";

export interface OrderStatusLabel {
  readonly label: string;
  readonly tone: Tone;
}

/**
 * Sipariş durumunun adı ve tonu (ikonsuz). Ayrı dosya: yalnız rozet gösteren ekran (dashboard)
 * orderStatus'taki ikonları paketine çekmesin. İkonlu meta: `orderStatus.ORDER_STATUS`.
 */
export const ORDER_STATUS_LABEL: Readonly<Record<OrderStatus, OrderStatusLabel>> = {
  PENDING: { label: "Bekliyor", tone: "warning" },
  ACCEPTED: { label: "Kabul Edildi", tone: "info" },
  PREPARING: { label: "Hazırlanıyor", tone: "primary" },
  SERVED: { label: "Servis Edildi", tone: "success" },
  CANCELLED: { label: "İptal", tone: "danger" },
  REJECTED: { label: "Reddedildi", tone: "danger" },
};

/** Sunucu bilinmeyen bir durum gönderirse "Bekliyor" gibi gösterilir */
export function orderStatusLabel(status: OrderStatus): OrderStatusLabel {
  return ORDER_STATUS_LABEL[status] ?? ORDER_STATUS_LABEL.PENDING;
}
