export const WAITER_REASONS = [
  "Sipariş vermek istiyorum",
  "Masa kirli",
  "Siparişim gecikti",
  "Ekstra peçete istiyorum",
  "Çatal / kaşık / bıçak istiyorum",
  "Genel yardım istiyorum",
  "Diğer",
];

// Görseli olmayan ürünler için düz, sıcak kâğıt tonları (köz, safran, domates, fesleğen, kemik)
const FOOD_TILES = ["#FFE6D9", "#FBEFCF", "#FBE3E1", "#E1F2E6", "#EFE6DA"];
export const foodTile = (id: string) =>
  FOOD_TILES[Array.from(id).reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % FOOD_TILES.length];

// JS scrollTo, CSS'teki prefers-reduced-motion kuralından etkilenmez
export const scrollBehavior = (): ScrollBehavior =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";

// ✅ PERF: Polling aralıkları — sekme gizliyken hepsi durur, görünür olunca hemen yenilenir
// (useVisiblePolling). Önceki: menü 5 sn, aktif talepler 5 sn, adisyon 8 sn.
export const MENU_POLL_MS = 60_000; // If-None-Match ile; menü değişmediyse gövdesiz 304
export const PENDING_SYNC_MS = 3_000; // garson onayı bekleniyor: onay anı hızlı görünsün
export const ACTIVE_REQUESTS_POLL_MS = 5_000; // bekleyen talep varken
export const ACTIVE_REQUESTS_IDLE_POLL_MS = 15_000; // bekleyen talep yokken
export const LIVE_BILL_POLL_MS = 15_000;
