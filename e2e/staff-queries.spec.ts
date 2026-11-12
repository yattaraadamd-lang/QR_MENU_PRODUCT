import { expect, test } from "@playwright/test";
import { signIn, VIEWPORT } from "./support/customer";

/**
 * Personel ekranı ana listesini ilk yüklemede bir kez ister (FE-ARCH-3.5). Soket aboneliği,
 * sayfa açılırken kurulan ilk bağlantıyı "yeniden bağlanma" sayıp listeyi ikinci kez istiyordu;
 * soketli dokuz ekranın hepsinde her açılışta iki istek gidiyordu. Pencere ekranın yoklama
 * aralığından (garson masaları 5 sn) kısa: yalnız ilk yükleme sayılır.
 */
test.describe("personel sorguları", () => {
  test.use({ viewport: VIEWPORT });

  test("garson masaları: ilk yüklemede liste bir kez istenir", async ({ page }) => {
    await signIn(page.request, "WAITER");
    const listRequests: number[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/waiter/tables") listRequests.push(Date.now());
    });

    const startedAt = Date.now();
    const connected = page.waitForEvent("console", { predicate: (message) => message.text().includes("[Socket] Connected") });
    await page.goto("/waiter/tables");
    await connected;
    const connectMs = Date.now() - startedAt;
    await page.waitForTimeout(1500);

    // Soket geç bağlanırsa (yavaş ortam) aradaki olaylar kaçmış olabilir: liste bilerek yenilenir
    test.skip(connectMs > 1500, `soket ${connectMs} ms'de bağlandı; bu durumda yenileme beklenir`);
    expect(listRequests, "ilk yüklemedeki liste istekleri").toHaveLength(1);
  });
});
