import { expect, test } from "@playwright/test";
import { scanAndAddProduct, tableQrPath, toast, VIEWPORT } from "./support/customer";

/**
 * Müşteri akışı uçtan uca (FE-ARCH-2.4): masa güveninin istemci tarafını korur.
 * QR → menü → sepet → sipariş talebi (onay kodu) → demo otomatik onayı → sipariş; aynı masaya
 * ikinci cihaz sipariş talebi veremez. QR token'ı yönetici uçlarından alınır (demo seed ister).
 * CI her koşuda taze veritabanı kullanır; yerelde kullanılmamış bir masa seçin (E2E_CUSTOMER_TABLE).
 */

const TABLE_NUMBER = process.env.E2E_CUSTOMER_TABLE ?? "2";

test.describe("müşteri akışı", () => {
  test.use({ viewport: VIEWPORT });

  test("QR → sipariş talebi → onay → sipariş; ikinci cihaz masayı alamaz", async ({ page, browser, request }) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const qrPath = await tableQrPath(request, TABLE_NUMBER);

    await scanAndAddProduct(page, qrPath, TABLE_NUMBER);
    // Oturum hidrasyonu bitince buton etkinleşir
    const requestButton = page.getByRole("button", { name: "Sipariş talebi oluştur" });
    await expect(requestButton).toBeEnabled({ timeout: 15_000 });
    await requestButton.click();
    await expect(toast(page, "Sipariş talebiniz oluşturuldu")).toBeVisible();
    await expect(page.getByText("Masa doğrulama kodunuz")).toBeVisible();

    // Demo: garson onaylamazsa sistem ≈20 sn sonra onaylar; PENDING yoklaması bunu görür
    await expect(toast(page, "Masanız açıldı")).toBeVisible({ timeout: 60_000 });
    await page.getByRole("button", { name: "Siparişi gönder" }).click();
    await expect(toast(page, "Siparişiniz gönderildi")).toBeVisible();

    // İkinci cihaz: menüyü görür, ama masa ilk cihazda olduğu için sipariş talebi reddedilir
    const secondDevice = await browser.newContext({ viewport: VIEWPORT });
    const other = await secondDevice.newPage();
    other.on("pageerror", (e) => errors.push(`ikinci cihaz: ${e.message}`));
    await scanAndAddProduct(other, qrPath, TABLE_NUMBER);
    const otherRequest = other.getByRole("button", { name: "Sipariş talebi oluştur" });
    await expect(otherRequest).toBeEnabled({ timeout: 15_000 });

    // Ağ yokken eylem sessiz kalmaz, anlaşılır bir hata gösterir (FE-ARCH-2.6)
    await secondDevice.setOffline(true);
    await otherRequest.click();
    await expect(toast(other, "Bağlantı hatası. Lütfen tekrar deneyin.")).toBeVisible();
    await secondDevice.setOffline(false);

    await otherRequest.click();
    await expect(toast(other, "Bu masa başka bir aktif oturuma ait")).toBeVisible();
    await expect(other.getByRole("button", { name: "Masa başka oturuma ait" })).toBeDisabled();
    await secondDevice.close();

    expect(errors, "sayfa hataları").toEqual([]);
  });
});
