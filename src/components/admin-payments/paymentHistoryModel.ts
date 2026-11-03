import { localDateKey } from "@/lib/format";
import type { FilterTab } from "@/components/ui/FilterTabs";
import type { Tone } from "@/components/ui/tone";
import type { DateRange, PaymentFilter, PaymentRecordDTO, PaymentStatus } from "./types";

export const PAYMENT_STATUS: Readonly<Record<PaymentStatus, { label: string; tone: Tone }>> = {
  PENDING: { label: "Müşteri Talebi", tone: "warning" },
  AWAITING_ADMIN_APPROVAL: { label: "Admin Onayı Bekliyor", tone: "warning" },
  PROCESSING: { label: "İşleniyor", tone: "info" },
  PAID: { label: "Ödendi", tone: "success" },
  REJECTED: { label: "Reddedildi", tone: "danger" },
  CANCELLED: { label: "İptal Edildi", tone: "neutral" },
  FAILED: { label: "Başarısız", tone: "danger" },
};

export function paymentStatusMeta(status: string) {
  return PAYMENT_STATUS[status as PaymentStatus] ?? { label: status, tone: "neutral" as Tone };
}

const AWAITING = new Set<string>(["PENDING", "AWAITING_ADMIN_APPROVAL"]);

const MATCHERS: Readonly<Record<PaymentFilter, (p: PaymentRecordDTO) => boolean>> = {
  ALL: () => true,
  AWAITING: (p) => AWAITING.has(p.status),
  COMPLETED: (p) => p.status === "PAID",
  REJECTED: (p) => p.status === "REJECTED",
};

export const PAYMENT_FILTER_TABS: readonly FilterTab<PaymentFilter>[] = [
  { value: "ALL", label: "Tümü" },
  { value: "AWAITING", label: "Onay Bekleyenler" },
  { value: "COMPLETED", label: "Tamamlananlar" },
  { value: "REJECTED", label: "Reddedilenler" },
];

/** Varsayılan aralık: son 30 gün (yerel takvim) */
const DEFAULT_RANGE_DAYS = 30;
const MS_PER_DAY = 86_400_000;

export function defaultDateRange(now: number): DateRange {
  return { start: localDateKey(now - DEFAULT_RANGE_DAYS * MS_PER_DAY), end: localDateKey(now) };
}

/** Kaydın günü: ödendiyse ödeme anı, değilse oluşturulma */
function recordDay(p: PaymentRecordDTO): string {
  return localDateKey(p.paidAt ?? p.createdAt);
}

export function filterPayments(payments: readonly PaymentRecordDTO[], filter: PaymentFilter, range: DateRange) {
  return payments.filter((p) => {
    if (!MATCHERS[filter](p)) return false;
    const day = recordDay(p);
    return day >= range.start && day <= range.end;
  });
}

/** Özet kartları: onay bekleyen sayısı ve bugün alınan tutar (filtreden bağımsız) */
export function summarizePayments(payments: readonly PaymentRecordDTO[], now: number) {
  const today = localDateKey(now);
  return {
    awaiting: payments.filter(MATCHERS.AWAITING).length,
    todayTotal: payments
      .filter((p) => p.status === "PAID" && p.paidAt !== null && localDateKey(p.paidAt) === today)
      .reduce((sum, p) => sum + Number(p.amount), 0),
  };
}
