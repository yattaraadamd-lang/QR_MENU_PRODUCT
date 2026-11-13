import { useSyncExternalStore } from "react";

const subscribe = (onChange: () => void) => {
  window.addEventListener("load", onChange);
  return () => window.removeEventListener("load", onChange);
};
const isLoaded = () => document.readyState === "complete";
const notOnServer = () => false;

/**
 * Sayfanın load olayı geçti mi. İlk ekran dışındaki ürün görselleri bunu bekler: Chrome
 * loading="lazy" görselleri ekranın 1250 px altına kadar hemen indiriyor; bu baytlar ilk ekranın
 * görseliyle bant genişliği paylaşıp menünün LCP'sini geciktiriyordu (Lighthouse, mobil 4G).
 */
export function usePageLoaded(): boolean {
  return useSyncExternalStore(subscribe, isLoaded, notOnServer);
}
