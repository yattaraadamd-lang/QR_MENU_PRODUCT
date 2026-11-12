import { expect, test } from "@playwright/test";
import { BUSINESS_LIMITS } from "../src/contracts/business";
import { TABLE_LIMITS } from "../src/contracts/tables";
import { signIn, VIEWPORT } from "./support/customer";

/**
 * Form doğrulaması uçtan uca (FE-ARCH-3.4): alan sınırı sunucu şemasında ve form alanında aynı
 * sabitten gelir; sunucunun alan hatası ilgili alanın altında, alana bağlı olarak görünür.
 * İsteklerin hepsi reddedilir: testler veri değiştirmez.
 */
test.describe("form doğrulaması", () => {
  test.use({ viewport: VIEWPORT });

  test("sunucu, sınırı aşan alanı adıyla ve ortak sınırla bildirir", async ({ request }) => {
    await signIn(request, "ADMIN");
    const response = await request.post("/api/admin/tables", {
      data: { tableNumber: "9".repeat(TABLE_LIMITS.number + 1) },
    });
    expect(response.status()).toBe(400);
    const body = (await response.json()) as { code?: string; error?: string; fieldErrors?: Record<string, string> };
    const reason = `En fazla ${TABLE_LIMITS.number} karakter olabilir.`;
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.fieldErrors).toEqual({ tableNumber: reason });
    expect(body.error).toBe(`Geçersiz alan: tableNumber. ${reason}`);
  });

  test("işletme ayarları: sunucunun e-posta hatası alanın altında görünür", async ({ page }) => {
    await signIn(page.request, "ADMIN");
    await page.goto("/admin/settings");
    await expect(page.getByLabel("İşletme Adı", { exact: true })).toHaveAttribute("maxlength", String(BUSINESS_LIMITS.name));

    // "a@b" tarayıcının e-posta doğrulamasından geçer, sunucu şemasında takılır
    const email = page.getByLabel("E-posta", { exact: true });
    await email.fill("a@b");
    await page.getByRole("button", { name: /Kaydet/ }).click();

    await expect(email).toHaveAttribute("aria-invalid", "true");
    await expect(email).toHaveAccessibleDescription("Geçerli bir e-posta adresi girin.");
    await expect(email).toBeFocused();
    await expect(page.getByRole("alert").filter({ hasText: "İşaretli alanları düzeltip yeniden deneyin." })).toBeVisible();

    // Kullanıcı alanı düzeltmeye başlayınca alanın hatası kalkar
    await email.fill("");
    await expect(email).not.toHaveAttribute("aria-invalid", "true");
  });

  test("yeni masa: kullanılan numara alanın altında bildirilir", async ({ page }) => {
    await signIn(page.request, "ADMIN");
    await page.goto("/admin/tables");
    await page.getByRole("button", { name: "+ Yeni Masa" }).click();
    const dialog = page.getByRole("dialog", { name: "Yeni Masa Ekle" });
    const number = dialog.getByLabel("Masa Numarası *");
    await expect(number).toHaveAttribute("maxlength", String(TABLE_LIMITS.number));

    // Demo seed'de 1 numaralı masa var: istek reddedilir, masa oluşmaz
    await number.fill("1");
    await dialog.getByRole("button", { name: "Masa Oluştur" }).click();
    await expect(number).toHaveAccessibleDescription("Bu masa numarası zaten kullanılıyor");
    await expect(number).toHaveAttribute("aria-invalid", "true");
    await expect(number).toBeFocused();
    await expect(dialog).toBeVisible();
  });
});
