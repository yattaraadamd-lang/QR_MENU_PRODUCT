/**
 * Herkese açık demo işletmesi. Akışı gerçek işletmeyle aynıdır (QR kanıtı, salt görüntüleme, garson
 * onayı); yalnız başına deneyen ziyaretçi takılmasın diye iki farkı vardır: onay gecikirse sistem
 * onaylar, boşta kalan masa bir sonraki QR okutmada serbest kalır.
 */
export const DEMO_BUSINESS_ID = process.env.DEMO_BUSINESS_ID || "demo-business-id";

/** Demoyu gösteren kişiye garson panelinden onaylayacak süre bırakır */
export const DEMO_AUTO_APPROVE_DELAY_MS = 20 * 1000;

/** Masayı tutan cihaz bu süre işlem yapmazsa masa bir sonraki okutmada kapatılır */
export const DEMO_IDLE_RELEASE_MS = 30 * 60 * 1000;

export function isDemoBusiness(businessId: string): boolean {
  return businessId === DEMO_BUSINESS_ID;
}
