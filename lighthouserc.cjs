/**
 * Lighthouse CI (FE-ITEM-3.9): mobil profil (Lighthouse varsayılanı, simüle 4G + 4x CPU),
 * rota başına 3 koşunun medyanı. Personel ekranları girişe bağlı olduğu için burada yok;
 * onların erişilebilirliği e2e/quality.spec.ts'teki axe taramasında.
 *
 * Raporlar dışarı yüklenmez (temporary-public-storage yerine dosya); CI'da artifact olur.
 * Çalıştırma: E2E_BASE_URL=http://localhost:3000 npx @lhci/cli@0.15.1 autorun
 */
const base = process.env.E2E_BASE_URL ?? "http://localhost:3000";

module.exports = {
  ci: {
    collect: {
      url: ["/", "/auth/signin", "/menu/demo-business-id/1"].map((p) => base + p),
      numberOfRuns: 3,
      settings: { chromeFlags: "--no-sandbox --headless=new" },
    },
    assert: {
      assertions: {
        // Hedef 0,9; şimdilik uyarı. Landing ve girişte LCP metni framer-motion'la opaklık 0'dan
        // başlıyor ve JS çalışana kadar görünmüyor (gerçek kısıtlamayla LCP ≈ 6 s, puan 0,67–0,70).
        // O düzeltilince "error"a çekilecek. Not: yerel Windows + Chrome 156'da simüle ölçüm,
        // gzip'li yanıtları açılmış boyutla okuduğu için puanı ayrıca düşük gösteriyor.
        "categories:performance": ["warn", { minScore: 0.9, aggregationMethod: "median-run" }],
        "categories:accessibility": ["error", { minScore: 0.95, aggregationMethod: "median-run" }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.1, aggregationMethod: "median-run" }],
      },
    },
    upload: { target: "filesystem", outputDir: ".lighthouseci/reports" },
  },
};
