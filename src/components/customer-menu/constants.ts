export const BRAND = "#CF411E"; // Paprika — iştah açıcı kırmızı-turuncu
export const BRAND_DARK = "#B23415";
export const BRAND_RGB = "217,68,31";

export const WAITER_REASONS = [
  "Sipariş vermek istiyorum",
  "Masa kirli",
  "Siparişim gecikti",
  "Ekstra peçete istiyorum",
  "Çatal / kaşık / bıçak istiyorum",
  "Genel yardım istiyorum",
  "Diğer",
];

// Görseli olmayan ürünler için sıcak, iştah açıcı kutucuk degradeleri
const FOOD_TILES = [
  "linear-gradient(135deg,#FDBA74,#CF411E)",
  "linear-gradient(135deg,#FCD27A,#D9820B)",
  "linear-gradient(135deg,#F6A19A,#B3261E)",
  "linear-gradient(135deg,#BBE2C1,#2E8B47)",
  "linear-gradient(135deg,#E7C9A9,#8C5A3C)",
];
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
