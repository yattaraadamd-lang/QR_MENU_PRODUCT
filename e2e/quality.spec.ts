import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Çalışma zamanı erişilebilirlik ve düzen kapısı (FE-ITEM-3.9). jsx-a11y statik taramasının
 * göremediğini yakalar: kontrast, landmark, ARIA durumu, odak görünürlüğü, 320px taşma.
 * Veri prisma/seed.ts'ten gelir (demo işletmesi, masa 1, admin ve garson hesabı); personel
 * hesapları E2E_ADMIN_* / E2E_WAITER_* ortam değişkenlerinden okunur.
 */

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const MENU = "/menu/demo-business-id/1";
const PUBLIC_ROUTES = ["/", "/auth/signin", MENU];
const ADMIN_ROUTES = ["/admin", "/admin/tables", "/admin/products", "/admin/orders"];
const WAITER_ROUTES = ["/waiter", "/waiter/requests", "/waiter/tables", "/waiter/payments"];

async function open(page: Page, path: string) {
  await page.goto(path);
  // Personel ekranları polling + soket kullandığı için networkidle'a güvenilmez
  await page.locator("main").first().waitFor();
  await page.waitForTimeout(300);
  // Giriş animasyonları bitmeden ölçülen kontrast yarı saydam ara renkleri görür
  // (landing'de 4,41:1 gibi sahte ihlaller); sonsuz döngüler (yükleniyor, nabız) beklenmez
  await page.waitForFunction(
    () =>
      document
        .getAnimations()
        .every((a) => a.playState !== "running" || a.effect?.getComputedTiming().endTime === Infinity),
    undefined,
    { timeout: 10_000 },
  );
}

/** İhlalleri okunur satırlara çevirir: kırmızıda neyin bozulduğu doğrudan görünsün */
async function axeViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  return violations.map(
    (v) => `${v.id} [${v.impact}] ${v.nodes.length} öğe — ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`,
  );
}

async function login(page: Page, role: "ADMIN" | "WAITER") {
  const email = process.env[`E2E_${role}_EMAIL`];
  const password = process.env[`E2E_${role}_PASSWORD`];
  test.skip(!email || !password, `E2E_${role}_EMAIL / E2E_${role}_PASSWORD tanımlı değil`);
  const { csrfToken } = await (await page.request.get("/api/auth/csrf")).json();
  const res = await page.request.post("/api/auth/callback/credentials", {
    form: { email: email!, password: password!, csrfToken, json: "true" },
  });
  expect(res.ok(), `${role} girişi başarısız (${res.status()})`).toBeTruthy();
}

test.describe("axe (WCAG 2.2 AA)", () => {
  for (const path of PUBLIC_ROUTES) {
    test(`herkese açık ${path}`, async ({ page }) => {
      await open(page, path);
      expect(await axeViolations(page)).toEqual([]);
    });
  }

  test("admin ekranları", async ({ page }) => {
    await login(page, "ADMIN");
    for (const path of ADMIN_ROUTES) {
      await open(page, path);
      expect.soft(await axeViolations(page), path).toEqual([]);
    }
  });

  test("garson ekranları", async ({ page }) => {
    await login(page, "WAITER");
    for (const path of WAITER_ROUTES) {
      await open(page, path);
      expect.soft(await axeViolations(page), path).toEqual([]);
    }
  });
});

test.describe("tercih emülasyonları", () => {
  test("zorunlu renk modunda odak ve dolu düğme görünür", async ({ page }) => {
    await page.emulateMedia({ forcedColors: "active" });
    await open(page, "/auth/signin");

    // Alan odağı box-shadow ile çizilir; bu modda gölge silinir, saydam outline kalır
    const field = page.locator("input.input").first();
    await field.focus();
    const outline = await field.evaluate((el) => {
      const s = getComputedStyle(el);
      return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) };
    });
    expect(outline.style).not.toBe("none");
    expect(outline.width).toBeGreaterThan(0);

    // Degrade zemin silinir: dolu düğme sistem vurgu rengiyle ters çevrilmeli
    const bg = await page.locator(".btn-primary").first().evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).not.toBe("rgba(0, 0, 0, 0)");
  });

  test("hareketi azalt açıkken liste kayarak gelmez", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page, MENU);
    const name = await page.locator(".stagger > *").first().evaluate((el) => getComputedStyle(el).animationName);
    expect(name).toBe("none");
  });
});

test.describe("320px yeniden akış", () => {
  test.use({ viewport: { width: 320, height: 640 } });

  for (const path of PUBLIC_ROUTES) {
    test(`${path} yatay taşmıyor ve kesilmiyor`, async ({ page }) => {
      await open(page, path);
      const result = await page.evaluate(() => {
        const W = document.documentElement.clientWidth;
        const clipped: string[] = [];
        for (const el of document.querySelectorAll<HTMLElement>("body *")) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.right <= W + 1 || getComputedStyle(el).position === "fixed") continue;
          // Kendi kaydırma kabı içinde kalan taşma (ör. kategori şeridi) beklenen davranış
          let inner = false;
          for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
            if (getComputedStyle(a).overflowX !== "visible" && a.getBoundingClientRect().right <= W + 1) {
              inner = true;
              break;
            }
          }
          if (!inner && !el.closest("[aria-hidden='true']")) clipped.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)}`);
        }
        return { overflow: document.documentElement.scrollWidth - W, clipped: clipped.slice(0, 5) };
      });
      expect(result.overflow).toBeLessThanOrEqual(0);
      expect(result.clipped).toEqual([]);
    });
  }
});
