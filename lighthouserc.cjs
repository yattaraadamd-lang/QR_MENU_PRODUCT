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
        // Landing ve girişin ilk ekran metni artık JS'yi beklemiyor (CSS girişi, LCP = FCP).
        // Not: yerel Windows + Chrome 156'da simüle ölçüm gzip'li yanıtları açılmış boyutla
        // okuyup puanı düşük gösteriyor; eşiğin ölçüsü CI (Linux). Sonuçlar "Lighthouse summary"
        // adımında notice olarak görünür.
        "categories:performance": ["error", { minScore: 0.9, aggregationMethod: "median-run" }],
        "categories:accessibility": ["error", { minScore: 0.95, aggregationMethod: "median-run" }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.1, aggregationMethod: "median-run" }],
      },
    },
    upload: { target: "filesystem", outputDir: ".lighthouseci/reports" },
  },
};
