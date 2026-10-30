import { defineConfig } from "@playwright/test";

/**
 * Ön yüz kalite kapısı (FE-ITEM-3.9): axe taraması, zorunlu renk / hareketi azalt
 * emülasyonu ve 320px yeniden akış. Tarayıcı indirmez: makinedeki Chrome kullanılır
 * (GitHub ubuntu-latest'te kurulu). E2E_BASE_URL verilirse o sunucuya bağlanır (CI'da
 * Lighthouse ile paylaşılan üretim sunucusu); verilmezse `npm start` başlatılır.
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  // Giriş hız sınırı (e-posta başına 15 dakikada 5) paralel koşuda kolay dolar
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    channel: process.env.PW_CHANNEL ?? "chrome",
    locale: "tr-TR",
    trace: "retain-on-failure",
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "npm start", url: baseURL, timeout: 120_000, reuseExistingServer: true },
});
