import { expect, test } from "@playwright/test";
import { scanAndAddProduct, signIn, tableQrPath, toast, VIEWPORT } from "./support/customer";

/**
 * Personel bildirimleri uçtan uca (FE-ARCH-3.2): müşteri masa açma talebi oluşturunca garson
 * ekranında elle kapatılana kadar kalan uyarı, zil rozeti ve çekmece kaydı görünür. Ses çıkışı
 * CI'da ölçülemez; garsonda ses tercihinin varsayılan açık olduğu, ses düğmesinden okunur.
 * Masa customer-flow'dakinden farklı olmalı (E2E_NOTIFY_TABLE, varsayılan 3); yerelde
 * kullanılmamış bir masa seçin.
 */

const TABLE_NUMBER = process.env.E2E_NOTIFY_TABLE ?? "3";

test.describe("personel bildirimleri", () => {
  test.use({ viewport: VIEWPORT });

  test("masa açma talebi garson ekranında uyarı, zil ve çekmece olarak görünür", async ({ page, browser, request }) => {
    test.setTimeout(90_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const qrPath = await tableQrPath(request, TABLE_NUMBER);

    // Garson ekranı işletme odasına bağlanana kadar beklenir (sunucu bağlanınca odaya katar)
    await signIn(page.request, "WAITER");
    const connected = page.waitForEvent("console", { predicate: (message) => message.text().includes("[Socket] Connected") });
    await page.goto("/waiter");
    await connected;
    const bell = page.locator("#notification-bell");
    await expect(bell).toHaveAccessibleName("Bildirimler");
    // Ses tercihi garsonda varsayılan açık: ya çalışıyor ya tarayıcı kilidini gösteriyor
    await expect(page.locator("#sound-toggle-btn")).toHaveAccessibleName(/Sesli bildirimleri kapat|Dokun, sesi aç/);

    // Müşteri cihazı masa açma talebi oluşturur
    const customer = await browser.newContext({ viewport: VIEWPORT });
    const menu = await customer.newPage();
    await scanAndAddProduct(menu, qrPath, TABLE_NUMBER);
    const requestButton = menu.getByRole("button", { name: "Sipariş talebi oluştur" });
    await expect(requestButton).toBeEnabled({ timeout: 15_000 });
    await requestButton.click();
    await expect(toast(menu, "Sipariş talebiniz oluşturuldu")).toBeVisible();
    await customer.close();

    // Kritik bildirim garsonda elle kapatılana kadar kalır; zil okunmamışı gösterir
    const alert = page.getByRole("alert").filter({ hasText: "Masa Açma Talebi" });
    await expect(alert).toBeVisible();
    await expect(alert).toContainText("sipariş talebi oluşturdu");
    await expect(bell).toHaveAccessibleName("Bildirimler: 1, 1 okunmamış");
    await alert.getByRole("button", { name: "Bildirimi kapat" }).click();
    await expect(alert).toBeHidden();

    // Çekmece açılınca kayıt listede, okunmamış sıfırlanır
    await bell.click();
    const drawer = page.getByRole("dialog", { name: /^Bildirimler/ });
    await expect(drawer.getByText("Masa Açma Talebi")).toBeVisible();
    await drawer.getByRole("button", { name: "Paneli kapat" }).click();
    await expect(drawer).toBeHidden();
    await expect(bell).toHaveAccessibleName("Bildirimler: 1");

    expect(errors, "sayfa hataları").toEqual([]);
  });
});
