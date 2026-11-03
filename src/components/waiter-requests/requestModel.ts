import type { Tone } from "@/components/ui/tone";
import type { RequestStatus, RequestType, ServiceRequestDTO } from "./types";

interface TypeMeta {
  readonly label: string;
  readonly icon: string;
  readonly tone: Tone;
}

const REQUEST_TYPE: Readonly<Record<RequestType, TypeMeta>> = {
  CALL_WAITER: { label: "Garson Çağrısı", icon: "🙋", tone: "danger" },
  PAYMENT_REQUEST: { label: "Ödeme Talebi", icon: "💳", tone: "purple" },
  HELP_REQUEST: { label: "Yardım Talebi", icon: "ℹ️", tone: "info" },
  CLEANING_REQUEST: { label: "Temizlik", icon: "🧹", tone: "neutral" },
  ORDER_REQUEST: { label: "Sipariş Talebi", icon: "📋", tone: "warning" },
  PRODUCT_INFO: { label: "Ürün Bilgisi", icon: "❓", tone: "success" },
  COMPLAINT_SUGGESTION: { label: "Şikayet/Öneri", icon: "💬", tone: "purple" },
};

/** Bilinmeyen tür sunucudan gelirse adı olduğu gibi gösterilir */
export function requestTypeMeta(type: string): TypeMeta {
  return REQUEST_TYPE[type as RequestType] ?? { label: type, icon: "📌", tone: "neutral" };
}

export const REQUEST_STATUS: Readonly<Record<RequestStatus, { label: string; tone: Tone }>> = {
  PENDING: { label: "Bekliyor", tone: "warning" },
  SEEN: { label: "Görüldü", tone: "info" },
  IN_PROGRESS: { label: "İşlemde", tone: "primary" },
  COMPLETED: { label: "Tamamlandı", tone: "success" },
  CANCELLED: { label: "İptal", tone: "neutral" },
};

export function requestStatusMeta(status: RequestStatus) {
  return REQUEST_STATUS[status] ?? REQUEST_STATUS.PENDING;
}

/** Müşterinin ekranında gördüğü masa açma kodu */
export const VERIFICATION_CODE_LENGTH = 6;

export function isExpired(request: ServiceRequestDTO, now: number): boolean {
  return request.expiresAt !== null && new Date(request.expiresAt).getTime() < now;
}

export function isOpenRequest(request: ServiceRequestDTO): boolean {
  return request.status === "PENDING" || request.status === "SEEN" || request.status === "IN_PROGRESS";
}

/** Hizmet talebinin ilerletme adımı: bekleyen → işleme al, görülen/işlemdeki → tamamla */
export function nextRequestStep(status: RequestStatus): { next: RequestStatus; label: string } | null {
  if (status === "PENDING") return { next: "IN_PROGRESS", label: "▶ İşleme Al" };
  if (status === "SEEN" || status === "IN_PROGRESS") return { next: "COMPLETED", label: "✓ Tamamla" };
  return null;
}
