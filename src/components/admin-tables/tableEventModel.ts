import type { TableEventDTO } from "./adminTables.api";

/** Sunucu yeni bir neden yazarsa "Durum değişti" gösterilir */
const REASON_LABEL: Readonly<Record<string, string>> = {
  TABLE_OPENED: "Masa açıldı",
  ORDER_REQUEST_APPROVED: "Sipariş talebi doğrulama koduyla onaylandı",
  ORDER_REQUEST_AUTO_APPROVED: "Demo: sistem onayladı",
  ORDER_REQUEST_REJECTED: "Sipariş talebi reddedildi",
  ORDER_ACCEPTED: "Sipariş onaylandı",
  ORDER_PREPARING: "Sipariş hazırlanıyor",
  ORDER_SERVED: "Sipariş servis edildi",
  ORDER_CANCELLED: "Sipariş iptal edildi",
  WAITER_CALLED: "Müşteri garson çağırdı",
  REQUEST_RESOLVED: "Talep kapatıldı",
  PAYMENT_REQUESTED: "Müşteri ödeme istedi",
  PAYMENT_COMPLETED: "Ödeme tamamlandı",
  TABLE_CLOSED: "Masa kapatıldı",
  TABLE_FORCE_CLOSED: "Masa zorla kapatıldı",
  DEMO_IDLE_RELEASE: "Demo masası boşta kaldığı için kapandı",
  MANUAL_STATUS: "Personel durumu elle değiştirdi",
};

export const tableEventLabel = (reason: string) => REASON_LABEL[reason] ?? "Durum değişti";

/** Değişikliği kim yaptı: personelin adı, yoksa kaynak */
export function tableEventActor(event: TableEventDTO): string {
  if (event.source === "CUSTOMER") return "Müşteri";
  if (event.source === "SYSTEM") return "Sistem";
  return event.actorName ?? "Personel";
}
