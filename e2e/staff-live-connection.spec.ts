import { expect, test, type Page } from "@playwright/test";
import { signIn, VIEWPORT } from "./support/customer";

/**
 * Canlı bağlantı kimlik hatasıyla düşünce personel kabuğu uyarır (FE-ARCH-3.9b). Gerçek hata
 * (oturum iptali, belirteç yenilenemedi) soket istemcisinin yaydığı olayla gelir; test aynı
 * olayları sayfada yayar. Önceden bu durumda ekran canlı güncellemeyi sessizce kaybediyordu.
 */
async function emit(page: Page, name: string, detail: Record<string, unknown>) {
  await page.evaluate(([eventName, eventDetail]) => {
    window.dispatchEvent(new CustomEvent(eventName, { detail: eventDetail }));
  }, [name, detail] as const);
}

test.describe("canlı bağlantı uyarısı", () => {
  test.use({ viewport: VIEWPORT });

  test("garson: kimlik hatasında uyarı çıkar, bağlantı dönünce kalkar, yenile sayfayı yeniler", async ({ page }) => {
    await signIn(page.request, "WAITER");
    const connected = page.waitForEvent("console", { predicate: (message) => message.text().includes("[Socket] Connected") });
    await page.goto("/waiter/tables");
    await connected;

    const alert = page.getByRole("alert").filter({ hasText: "Canlı bağlantı kesildi" });
    await expect(alert).toHaveCount(0);

    await emit(page, "socket-auth-failed", { code: "SESSION_REVOKED" });
    await expect(alert).toBeVisible();

    // Kopma uyarıyı kaldırmaz; yalnız yeniden kurulan bağlantı kaldırır
    await emit(page, "socket-connection-status", { connected: false });
    await expect(alert).toBeVisible();
    await emit(page, "socket-connection-status", { connected: true });
    await expect(alert).toBeHidden();

    await emit(page, "socket-auth-failed", { code: "TOKEN_REFRESH_FAILED" });
    await expect(alert).toBeVisible();
    await Promise.all([page.waitForEvent("load"), alert.getByRole("button", { name: "Sayfayı yenile" }).click()]);
    await expect(alert).toBeHidden();
  });
});
