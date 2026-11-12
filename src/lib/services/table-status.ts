import "server-only";
import type { OrderStatus, TableStatus } from "@prisma/client";

/**
 * Masa durumu kuralları: müşteri durumu yazmaz, sinyal üretir; durum kanıtlanmış kayıtlardan
 * türetilir. Saf modül (Prisma istemcisi yok): kurallar veritabanısız sınanabilsin.
 */

/**
 * Adisyona yazılan siparişler: garson onayından geçmiş olanlar. PENDING yalnız bir istektir;
 * reddedilebilir, bu yüzden tutara, ödemeye ve masa durumuna etki etmez.
 */
export const BILLABLE_ORDER_STATUSES: OrderStatus[] = ["ACCEPTED", "PREPARING", "SERVED"];

/** Aktif masa oturumu olan masanın anlık kanıtları */
export interface OpenTableFacts {
  /** Yalnız BILLABLE_ORDER_STATUSES içindeki sipariş durumları */
  readonly orderStatuses: readonly OrderStatus[];
  /** Açık ödeme talebi ya da bekleyen ödeme var ve kalan borç sıfırdan büyük */
  readonly hasPaymentRequest: boolean;
  /** Yanıtlanmamış garson çağrısı */
  readonly hasWaiterCall: boolean;
}

/**
 * Öncelik: sipariş aşaması > ödeme talebi > garson çağrısı > servis edildi > dolu.
 * Müşteri sinyalleri (ödeme, garson) mutfaktaki gerçeği ezemez; talep kapanınca durum kendiliğinden
 * döner. Sipariş sürerken gelen çağrı kayıpsızdır: panel kartındaki sayaç ve bildirim bunu gösterir.
 */
export function computeOpenTableStatus(facts: OpenTableFacts): TableStatus {
  if (facts.orderStatuses.includes("PREPARING")) return "PREPARING";
  if (facts.orderStatuses.includes("ACCEPTED")) return "HAS_ORDER";
  if (facts.hasPaymentRequest) return "PAYMENT_REQUESTED";
  if (facts.hasWaiterCall) return "WAITING_WAITER";
  if (facts.orderStatuses.includes("SERVED")) return "SERVED";
  return "OCCUPIED";
}

/**
 * Aktif oturumu olmayan masa. Geçmiş oturumların siparişleri sayılmaz: SERVED son durumdur, onları
 * saymak sipariş geçmişi olan her boş masayı "dolu" gösterirdi.
 */
export function computeClosedTableStatus(currentStatus: TableStatus, hasOpenBill: boolean): TableStatus {
  // Oturumsuz açık adisyon tutarsızlıktır; ödenmemiş hesap görünmez olmasın diye masa dolu kalır
  if (hasOpenBill) return "OCCUPIED";
  // Temizlik personelin verdiği karardır; talep kapanınca kaybolmaz
  return currentStatus === "CLEANING_NEEDED" ? "CLEANING_NEEDED" : "EMPTY";
}
