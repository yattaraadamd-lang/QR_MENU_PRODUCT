import type { NotificationItem, NotificationSoundMode, NotificationType } from "./types";

/** Personel soket olayı → bildirimin simgesi, başlığı ve sesi (audio.ts) */
const STAFF_EVENTS: Record<NotificationType, { icon: string; title: string; sound: string }> = {
  new_order: { icon: "🆕", title: "Yeni Sipariş", sound: "new_order" },
  call_waiter: { icon: "🙋", title: "Garson Çağrısı", sound: "call_waiter" },
  payment_request: { icon: "💳", title: "Ödeme Talebi", sound: "payment" },
  help_request: { icon: "ℹ️", title: "Yardım Talebi", sound: "urgent" },
  service_request: { icon: "🔔", title: "Hizmet Talebi", sound: "default" },
  // Masa açma talebi (ORDER_REQUEST)
  order_request_update: { icon: "🔓", title: "Masa Açma Talebi", sound: "order_request_update" },
};

export const STAFF_EVENT_NAMES = Object.keys(STAFF_EVENTS) as NotificationType[];

// Kritik bildirim türleri — garson panelinde toast elle kapatılana kadar kalır
const CRITICAL_TYPES = new Set<NotificationType>(["new_order", "order_request_update", "call_waiter", "help_request"]);

// Admin panelinde yalnızca bu olaylar ses çalar (garson çağrısı garsonun işi)
const ADMIN_SOUND_TYPES = new Set<NotificationType>(["new_order", "payment_request"]);

// Garson panelinde 3 sn sonra bir kez daha çalan sesler: çağrı ve ödeme kaçmasın
const REPEATED_SOUNDS = new Set(["call_waiter", "payment"]);
const REPEAT_AFTER_MS = 3000;

/**
 * Sunucudan gelen değeri düz metin olarak alır. React çıktıyı zaten kaçırır; burada HTML
 * varlığına çevirmek (eski sanitizeText) "Masa "Bahçe"" gibi metinleri &quot; ile gösteriyordu.
 */
function text(value: unknown): string {
  if (typeof value === "number") return String(value);
  return typeof value === "string" ? value.slice(0, 500) : "";
}

export function toNotification(type: NotificationType, data: Record<string, unknown>, mode: NotificationSoundMode): NotificationItem {
  const { icon, title } = STAFF_EVENTS[type];
  const tableName = text(data.tableName) || undefined;
  const tableNumber = text(data.tableNumber) || undefined;
  const tableLabel = tableName || `Masa ${tableNumber || "?"}`;
  return {
    id: `${Date.now()}-${Math.random()}`,
    type,
    icon,
    title,
    message: text(data.message) || `${tableLabel} ${title.toLocaleLowerCase("tr-TR")}`,
    tableNumber,
    tableName,
    createdAt: new Date(),
    // Admin panelinde toast'lar kalıcı değil — iş akışını bölmesin
    persistent: mode === "waiter" && CRITICAL_TYPES.has(type),
  };
}

/** Çalınacak ses (yoksa null) ve garsonda tekrar gecikmesi */
export function soundFor(type: NotificationType, mode: NotificationSoundMode) {
  if (mode === "admin" && !ADMIN_SOUND_TYPES.has(type)) return null;
  const sound = STAFF_EVENTS[type].sound;
  return { sound, repeatAfterMs: mode === "waiter" && REPEATED_SOUNDS.has(sound) ? REPEAT_AFTER_MS : undefined };
}

// ✅ SECURITY: aynı olayın (tür + masa) 3 sn içindeki tekrarı elenir
const DEDUP_WINDOW_MS = 3000;

export function createDeduper() {
  const seen = new Map<string, number>();
  return (type: string, tableNumber: unknown): boolean => {
    const key = `${type}:${text(tableNumber) || "?"}`;
    const now = Date.now();
    const last = seen.get(key);
    if (last && now - last < DEDUP_WINDOW_MS) return true;
    seen.set(key, now);
    for (const [k, t] of seen) if (now - t > DEDUP_WINDOW_MS * 2) seen.delete(k);
    return false;
  };
}
