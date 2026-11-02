import { AlertTriangle, Check, ChefHat, Clock, UtensilsCrossed, X, type LucideIcon } from "lucide-react";
import type { Tone } from "@/components/ui/tone";
import type { CancelReasonCode, OrderDTO, OrderStatus } from "./types";

interface StatusMeta {
  readonly label: string;
  readonly tone: Tone;
  readonly Icon: LucideIcon;
}

export const ORDER_STATUS: Readonly<Record<OrderStatus, StatusMeta>> = {
  PENDING: { label: "Bekliyor", tone: "warning", Icon: Clock },
  ACCEPTED: { label: "Kabul Edildi", tone: "info", Icon: Check },
  PREPARING: { label: "Hazırlanıyor", tone: "primary", Icon: ChefHat },
  SERVED: { label: "Servis Edildi", tone: "success", Icon: UtensilsCrossed },
  CANCELLED: { label: "İptal", tone: "danger", Icon: X },
  REJECTED: { label: "Reddedildi", tone: "danger", Icon: AlertTriangle },
};

export function orderStatusMeta(status: OrderStatus): StatusMeta {
  return ORDER_STATUS[status] ?? ORDER_STATUS.PENDING;
}

/** Bir sonraki adım: durum → { hedef, düğme etiketi, başarı mesajı } */
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

export const CANCEL_REASONS: readonly { readonly value: CancelReasonCode; readonly label: string }[] = [
  { value: "OUT_OF_STOCK", label: "Ürün stokta yok" },
  { value: "CUSTOMER_CANCELLED", label: "Müşteri vazgeçti" },
  { value: "WRONG_ORDER", label: "Yanlış sipariş" },
  { value: "TABLE_NOT_VERIFIED", label: "Masa doğrulanamadı" },
  { value: "BUSINESS_NOT_ACCEPTING", label: "İşletme sipariş almıyor" },
  { value: "OTHER", label: "Diğer" },
];

export interface OrderProduct {
  readonly id: string;
  readonly name: string;
}

/** Siparişteki farklı ürünler (stokta yok işaretlemek için) */
export function orderProducts(order: OrderDTO): OrderProduct[] {
  const products = new Map<string, string>();
  for (const item of order.items) {
    const id = item.productId ?? item.product?.id;
    if (id) products.set(id, item.productName || item.product?.name || "Bilinmeyen Ürün");
  }
  return Array.from(products, ([id, name]) => ({ id, name }));
}

export interface CancelFormValues {
  readonly reason: CancelReasonCode | null;
  readonly note: string;
  readonly outOfStockIds: readonly string[];
}

export function validateCancel(values: CancelFormValues): string | null {
  if (!values.reason) return "Lütfen bir neden seçin.";
  if (values.reason === "OUT_OF_STOCK" && values.outOfStockIds.length === 0) {
    return "Lütfen en az bir stok dışı kalacak ürün seçin.";
  }
  if (values.reason === "OTHER" && !values.note.trim()) return "Lütfen iptal nedeni açıklamasını yazın.";
  return null;
}

/** Müşteriye/rapora yazılan neden metni: "Diğer"de açıklamanın kendisi */
export function cancelReasonText(values: CancelFormValues): string {
  if (values.reason === "OTHER") return values.note.trim();
  return CANCEL_REASONS.find((r) => r.value === values.reason)?.label ?? "";
}
