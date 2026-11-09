import type { Tone } from "@/components/ui/tone";
import type { BillPaymentStatus, TableDTO, TableStatus } from "./types";

interface StatusMeta {
  readonly label: string;
  readonly tone: Tone;
}

export const TABLE_STATUS: Readonly<Record<TableStatus, StatusMeta>> = {
  EMPTY: { label: "Boş", tone: "neutral" },
  OCCUPIED: { label: "Dolu", tone: "info" },
  HAS_ORDER: { label: "Sipariş Var", tone: "warning" },
  PREPARING: { label: "Hazırlanıyor", tone: "success" },
  SERVED: { label: "Servis Edildi", tone: "success" },
  WAITING_WAITER: { label: "Garson Bekleniyor", tone: "danger" },
  PAYMENT_REQUESTED: { label: "Ödeme İsteniyor", tone: "purple" },
  CLEANING_NEEDED: { label: "Temizlik", tone: "primary" },
};

export const BILL_PAYMENT_STATUS: Readonly<Record<BillPaymentStatus, StatusMeta>> = {
  PAID: { label: "Ödendi", tone: "success" },
  PARTIALLY_PAID: { label: "Kısmi ödendi", tone: "warning" },
  UNPAID: { label: "Ödenmedi", tone: "danger" },
  CANCELLED: { label: "İptal", tone: "neutral" },
};

export const FORCE_CLOSE_REASONS = ["İkram", "İptal", "Müşteri ayrıldı", "Hatalı sipariş", "Diğer"] as const;
export type ForceCloseReason = (typeof FORCE_CLOSE_REASONS)[number];

/** Sunucu bilinmeyen bir durum gönderirse "Boş" gibi gösterilir */
export function tableStatusMeta(status: TableStatus): StatusMeta {
  return TABLE_STATUS[status] ?? TABLE_STATUS.EMPTY;
}

export { tableDisplayName } from "./tableName";

/** Bekleyen sipariş + talep + ödeme isteği: kartın köşesindeki sayaç */
export function countPendingActions(table: TableDTO): number {
  const pendingOrders = table.orders.filter((order) => order.status === "PENDING").length;
  const pendingRequests = table.serviceRequests.filter((request) => request.status === "PENDING").length;
  return pendingOrders + pendingRequests + (table.status === "PAYMENT_REQUESTED" ? 1 : 0);
}

export function hasUnpaidBill(table: TableDTO): boolean {
  return table.bill !== null && Number(table.bill.remainingAmount) > 0;
}
