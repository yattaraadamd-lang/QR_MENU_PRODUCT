/**
 * iyzico'da ürün + aylık ödeme planlarını oluşturur ve referanslarını
 * subscription_plans.iyzicoPricingPlanRef alanına yazar.
 *
 *   node prisma/iyzico-setup-plans.cjs
 *
 * Render build'i her deploy'da çalıştırır (render-build.js). Güvenli tekrar:
 * - IYZICO_API_KEY / IYZICO_SECRET_KEY yoksa hiçbir şey yapmadan çıkar.
 * - Sadece iyzico referansı olmayan aktif planlar işlenir.
 * - Ürün, aynı adla iyzico'da varsa yeniden kullanılır (IYZICO_PRODUCT_REF verilirse o kullanılır).
 *
 * Sandbox → canlıya geçiş: iyzico referansları ortamlar arasında geçerli değildir.
 * Canlı anahtarlara geçerken subscription_plans.iyzicoPricingPlanRef değerlerini boşaltın;
 * sonraki deploy canlı ortamda planları yeniden oluşturur.
 *
 * Fiyat değişikliği: iyzico mevcut planın fiyatını değiştirmeye izin vermez —
 * ilgili planın iyzicoPricingPlanRef alanını boşaltın, sonraki deploy yeni plan oluşturur.
 *
 * Düz Node.js — tsx/devDependency gerektirmez.
 */

const crypto = require("crypto");
const { PrismaClient } = require("@prisma/client");

const API_KEY = process.env.IYZICO_API_KEY;
const SECRET_KEY = process.env.IYZICO_SECRET_KEY;
const BASE_URL = process.env.IYZICO_BASE_URL || "https://sandbox-api.iyzipay.com";
const PRODUCT_NAME = "QR Menü Abonelik";

// src/lib/iyzico.ts ile aynı IYZWSv2 imzalama
async function iyzicoRequest(method, path, body) {
  const bodyString = body ? JSON.stringify(body) : "";
  const randomKey = `${Date.now()}${crypto.randomBytes(6).toString("hex")}`;
  const uriPath = path.split("?")[0];
  const signature = crypto
    .createHmac("sha256", SECRET_KEY)
    .update(randomKey + uriPath + bodyString)
    .digest("hex");
  const authorization = Buffer.from(
    `apiKey:${API_KEY}&randomKey:${randomKey}&signature:${signature}`
  ).toString("base64");

  const res = await fetch(BASE_URL + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `IYZWSv2 ${authorization}`,
      "x-iyzi-rnd": randomKey,
    },
    body: body ? bodyString : undefined,
  });

  const json = await res.json().catch(() => null);
  if (!json || json.status !== "success") {
    throw new Error(
      `iyzico ${method} ${uriPath} başarısız (${res.status}): ${json?.errorCode ?? ""} ${json?.errorMessage ?? ""}`.trim()
    );
  }
  return json;
}

async function findOrCreateProduct() {
  if (process.env.IYZICO_PRODUCT_REF) return process.env.IYZICO_PRODUCT_REF;

  try {
    const list = await iyzicoRequest("GET", "/v2/subscription/products?page=1&count=100");
    const existing = (list.data?.items ?? []).find((p) => p.name === PRODUCT_NAME);
    if (existing) {
      console.log(`📦 Mevcut iyzico ürünü kullanılıyor: ${existing.referenceCode}`);
      return existing.referenceCode;
    }
  } catch (e) {
    console.warn(`⚠️  iyzico ürün listesi alınamadı, yeni ürün oluşturulacak: ${e.message}`);
  }

  const created = await iyzicoRequest("POST", "/v2/subscription/products", {
    locale: "tr",
    conversationId: `product_${Date.now()}`,
    name: PRODUCT_NAME,
    description: "Aylık QR menü platformu aboneliği",
  });
  console.log(`📦 iyzico ürünü oluşturuldu: ${created.data.referenceCode}`);
  return created.data.referenceCode;
}

async function main() {
  if (!API_KEY || !SECRET_KEY) {
    console.log("↪️  IYZICO_API_KEY / IYZICO_SECRET_KEY tanımlı değil — iyzico plan kurulumu atlandı.");
    return;
  }

  const prisma = new PrismaClient();
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      where: { isActive: true, iyzicoPricingPlanRef: null },
      orderBy: { sortOrder: "asc" },
    });

    if (plans.length === 0) {
      console.log("↪️  Tüm aktif planların iyzico referansı var.");
      return;
    }

    console.log(`🔗 iyzico ortamı: ${BASE_URL}`);
    const productRef = await findOrCreateProduct();

    for (const plan of plans) {
      const res = await iyzicoRequest("POST", `/v2/subscription/products/${productRef}/pricing-plans`, {
        locale: "tr",
        conversationId: `plan_${plan.id}`,
        name: plan.name,
        price: Number(plan.monthlyPrice),
        currencyCode: "TRY",
        paymentInterval: "MONTHLY",
        paymentIntervalCount: 1,
        planPaymentType: "RECURRING",
      });
      const ref = res.data.referenceCode;
      await prisma.subscriptionPlan.update({ where: { id: plan.id }, data: { iyzicoPricingPlanRef: ref } });
      console.log(`✅ iyzico planı: ${plan.name} → ${ref}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("❌ iyzico plan kurulum hatası:", e.message);
  process.exit(1);
});
