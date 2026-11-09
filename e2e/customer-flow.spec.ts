import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

/**
 * Müşteri akışı uçtan uca (FE-ARCH-2.4): masa güveninin istemci tarafını korur.
 * QR → menü → sepet → sipariş talebi (onay kodu) → demo otomatik onayı → sipariş; aynı masaya
 * ikinci cihaz sipariş talebi veremez. QR token'ı yönetici uçlarından alınır (demo seed ister).
 * CI her koşuda taze veritabanı kullanır; yerelde kullanılmamış bir masa seçin (E2E_CUSTOMER_TABLE).
 */

const BUSINESS_ID = "demo-business-id";
const TABLE_NUMBER = process.env.E2E_CUSTOMER_TABLE ?? "2";
const VIEWPORT = { width: 1280, height: 900 };

const toast = (page: Page, text: string) => page.locator("[data-sonner-toast]").filter({ hasText: text });

/** Yönetici olarak masanın QR yolunu alır (generate-qr mevcut token'ı döndürür, yenilemez) */
async function tableQrPath(request: APIRequestContext): Promise<string> {
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  test.skip(!email || !password, "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD tanımlı değil");
  const { csrfToken } = await (await request.get("/api/auth/csrf")).json();
  const login = await request.post("/api/auth/callback/credentials", {
    form: { email: email!, password: password!, csrfToken, json: "true" },
  });
  expect(login.ok(), "yönetici girişi").toBeTruthy();

  const { tables } = (await (await request.get("/api/admin/tables")).json()) as {
    tables: { id: string; tableNumber: string }[];
  };
  const table = tables.find((t) => t.tableNumber === TABLE_NUMBER);
  expect(table, `masa ${TABLE_NUMBER}`).toBeTruthy();
  const qr = await request.post(`/api/admin/tables/${table!.id}/generate-qr`);
  expect(qr.ok(), "QR kodu").toBeTruthy();
  const { qrToken } = (await qr.json()) as { qrToken: string };
  return `/qr/${qrToken}`;
}

/** QR'ı okutur ve sipariş edilebilir ilk ürünü ürün penceresinden sepete ekler */
async function scanAndAddProduct(page: Page, qrPath: string) {
  await page.goto(qrPath);
  await page.waitForURL(`**/menu/${BUSINESS_ID}/${TABLE_NUMBER}`);
  await page.getByRole("button", { name: /^(?!.*mevcut değil).*ayrıntıları gör$/ }).first().click();
  await page.getByRole("button", { name: "Sepete ekle", exact: true }).click();
  await expect(toast(page, "sepete eklendi")).toBeVisible();
}

test.describe("müşteri akışı", () => {
  test.use({ viewport: VIEWPORT });

  test("QR → sipariş talebi → onay → sipariş; ikinci cihaz masayı alamaz", async ({ page, browser, request }) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const qrPath = await tableQrPath(request);

    await scanAndAddProduct(page, qrPath);
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
    await scanAndAddProduct(other, qrPath);
    const otherRequest = other.getByRole("button", { name: "Sipariş talebi oluştur" });
    await expect(otherRequest).toBeEnabled({ timeout: 15_000 });
    await otherRequest.click();
    await expect(toast(other, "Bu masa başka bir aktif oturuma ait")).toBeVisible();
    await expect(other.getByRole("button", { name: "Masa başka oturuma ait" })).toBeDisabled();
    await secondDevice.close();

    expect(errors, "sayfa hataları").toEqual([]);
  });
});
