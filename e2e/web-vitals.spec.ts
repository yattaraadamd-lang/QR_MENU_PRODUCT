import { expect, test } from "@playwright/test";

/**
 * Web Vitals açılışta istek atmaz; ölçüler sayfa gizlenince tek istekte gider (FE-ARCH-3.9b).
 * Önceden her ölçü ayrı istekti (her açılışta 2–3, aynı milisaniyede). Yalnız üretim
 * derlemesinde ölçülür; e2e üretim sunucusuna karşı koşar.
 */
test("Web Vitals: açılışta istek yok, sayfa gizlenince tek istek", async ({ page }) => {
  const bodies: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/vitals") bodies.push(request.postData() ?? "");
  });

  await page.goto("/auth/signin");
  // Ölçüm bileşeni ayrı chunk'ta iner; FCP ve TTFB arabellekteki kayıtlardan okunur
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
  expect(bodies, "açılışta ölçü isteği").toHaveLength(0);

  // Tarayıcı olayı belgede ve kabaran (bubbles) olarak yayar
  const hide = () =>
    page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
      document.dispatchEvent(new Event("visibilitychange", { bubbles: true }));
    });

  await hide();
  await expect.poll(() => bodies.length, { message: "gizlenince tek istek" }).toBe(1);
  const { metrics } = JSON.parse(bodies[0]) as { metrics: { name: string; route: string }[] };
  // CLS'nin dinleyicisi FCP'den sonra kurulur: o da aynı isteğe girmeli (önce ikinci istekte geliyordu)
  expect(metrics.map((metric) => metric.name)).toEqual(expect.arrayContaining(["TTFB", "FCP", "LCP", "CLS"]));
  expect(new Set(metrics.map((metric) => metric.route))).toEqual(new Set(["/auth/signin"]));

  // Gönderilen ölçüler kuyruktan çıkar: yeni ölçü yoksa ikinci gizlenme istek atmaz
  await hide();
  await page.waitForTimeout(500);
  expect(bodies).toHaveLength(1);
});
