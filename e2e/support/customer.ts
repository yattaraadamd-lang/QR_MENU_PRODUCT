import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

/** e2e ortak adımları: demo işletmesi (prisma/seed.ts) ve CI iş akışındaki test hesapları */

export const BUSINESS_ID = "demo-business-id";
export const VIEWPORT = { width: 1280, height: 900 };

export const toast = (page: Page, text: string) => page.locator("[data-sonner-toast]").filter({ hasText: text });

/** Kimlik bilgisiyle giriş. `page.request` verilirse oturum çerezi o sayfanın bağlamına yazılır. */
export async function signIn(request: APIRequestContext, role: "ADMIN" | "WAITER") {
  const email = process.env[`E2E_${role}_EMAIL`];
  const password = process.env[`E2E_${role}_PASSWORD`];
  test.skip(!email || !password, `E2E_${role}_EMAIL / E2E_${role}_PASSWORD tanımlı değil`);
  const { csrfToken } = (await (await request.get("/api/auth/csrf")).json()) as { csrfToken: string };
  const login = await request.post("/api/auth/callback/credentials", {
    form: { email: email!, password: password!, csrfToken, json: "true" },
  });
  expect(login.ok(), `${role} girişi`).toBeTruthy();
}

/** Yönetici olarak masanın QR yolunu alır (generate-qr mevcut token'ı döndürür, yenilemez) */
export async function tableQrPath(request: APIRequestContext, tableNumber: string): Promise<string> {
  await signIn(request, "ADMIN");
  const { tables } = (await (await request.get("/api/admin/tables")).json()) as {
    tables: { id: string; tableNumber: string }[];
  };
  const table = tables.find((t) => t.tableNumber === tableNumber);
  expect(table, `masa ${tableNumber}`).toBeTruthy();
  const qr = await request.post(`/api/admin/tables/${table!.id}/generate-qr`);
  expect(qr.ok(), "QR kodu").toBeTruthy();
  const { qrToken } = (await qr.json()) as { qrToken: string };
  return `/qr/${qrToken}`;
}

/** QR'ı okutur ve sipariş edilebilir ilk ürünü ürün penceresinden sepete ekler */
export async function scanAndAddProduct(page: Page, qrPath: string, tableNumber: string) {
  await page.goto(qrPath);
  await page.waitForURL(`**/menu/${BUSINESS_ID}/${tableNumber}`);
  await page.getByRole("button", { name: /^(?!.*mevcut değil).*ayrıntıları gör$/ }).first().click();
  await page.getByRole("button", { name: "Sepete ekle", exact: true }).click();
  await expect(toast(page, "sepete eklendi")).toBeVisible();
}
