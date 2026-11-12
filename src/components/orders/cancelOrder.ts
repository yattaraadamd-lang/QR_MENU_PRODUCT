import { ORDER_LIMITS } from "@/contracts/orders";
import type { CancelPayload, CancelReasonCode, OrderDTO } from "./types";

/** Sipariş reddetme/iptal: nedenler ve saf kurallar (garson + admin ortak) */

export const CANCEL_REASONS: readonly { readonly value: CancelReasonCode; readonly label: string }[] = [
  { value: "OUT_OF_STOCK", label: "Ürün stokta yok" },
  { value: "CUSTOMER_CANCELLED", label: "Müşteri vazgeçti" },
  { value: "WRONG_ORDER", label: "Yanlış sipariş" },
  { value: "TABLE_NOT_VERIFIED", label: "Masa doğrulanamadı" },
  { value: "BUSINESS_NOT_ACCEPTING", label: "İşletme sipariş almıyor" },
  { value: "OTHER", label: "Diğer" },
];

const LABEL_SEPARATOR = ": ";

/**
 * Açıklama alanının azami uzunluğu. Sunucu sınırı (ORDER_LIMITS.cancelReason) giden birleşik
 * metne ("Etiket: açıklama") uygulanır; en uzun etiket kadar yer ayrılmazsa uzun bir açıklama
 * sunucuda reddedilirdi.
 */
export const CANCEL_NOTE_MAX =
  ORDER_LIMITS.cancelReason - Math.max(...CANCEL_REASONS.map((reason) => reason.label.length)) - LABEL_SEPARATOR.length;

export interface OrderProduct {
  readonly id: string;
  readonly name: string;
}

/** Siparişteki farklı ürünler (stokta yok işaretlemek için) */
export function orderProducts(order: OrderDTO): OrderProduct[] {
  const products = new Map<string, string>();
  for (const item of order.items) products.set(item.productId, item.productName || "Bilinmeyen Ürün");
  return Array.from(products, ([id, name]) => ({ id, name }));
}

export interface CancelFormValues {
  readonly reason: CancelReasonCode | null;
  /** "Diğer"de zorunlu, diğerlerinde ek açıklama */
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

/** Müşteriye/rapora yazılan metin: "Diğer"de açıklamanın kendisi, diğerlerinde "Etiket: açıklama" */
function reasonText(reason: CancelReasonCode, note: string): string {
  if (reason === "OTHER") return note;
  const label = CANCEL_REASONS.find((r) => r.value === reason)?.label ?? reason;
  return note ? `${label}${LABEL_SEPARATOR}${note}` : label;
}

/** Doğrulanmış formdan istek gövdesi */
export function toCancelPayload(values: CancelFormValues & { reason: CancelReasonCode }): CancelPayload {
  return {
    reasonCode: values.reason,
    cancelReason: reasonText(values.reason, values.note.trim()),
    outOfStockProductIds: values.reason === "OUT_OF_STOCK" ? values.outOfStockIds : null,
  };
}
