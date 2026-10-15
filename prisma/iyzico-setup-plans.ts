/**
 * iyzico'da ürün + aylık ödeme planlarını oluşturur ve referanslarını
 * subscription_plans.iyzicoPricingPlanRef alanına yazar.
 *
 * Önce: npm run db:seed:plans
 * Sonra: npm run iyzico:setup-plans   (IYZICO_* ortam değişkenleri tanımlı olmalı)
 *
 * Zaten referansı olan planlar atlanır. Fiyat değişikliğinde iyzico'da yeni plan
 * oluşturulmalı (iyzico mevcut planın fiyatını değiştirmeye izin vermez):
 * ilgili planın iyzicoPricingPlanRef alanını boşaltıp script'i tekrar çalıştırın.
 */

import { PrismaClient } from "@prisma/client";
import { createProduct, createPricingPlan, isIyzicoConfigured } from "../src/lib/iyzico";

const prisma = new PrismaClient();

async function main() {
  if (!isIyzicoConfigured()) throw new Error("IYZICO_API_KEY / IYZICO_SECRET_KEY tanımlı değil");

  const plans = await prisma.subscriptionPlan.findMany({
    where: { isActive: true, iyzicoPricingPlanRef: null },
    orderBy: { sortOrder: "asc" },
  });
  if (plans.length === 0) {
    console.log("Tüm aktif planların iyzico referansı var.");
    return;
  }

  const productRef = process.env.IYZICO_PRODUCT_REF || (await createProduct("QR Menü Abonelik", "Aylık QR menü platformu aboneliği"));
  console.log(`📦 iyzico ürün: ${productRef}  (tekrar kullanmak için IYZICO_PRODUCT_REF olarak kaydedin)`);

  for (const plan of plans) {
    const ref = await createPricingPlan(productRef, { name: plan.name, price: Number(plan.monthlyPrice) });
    await prisma.subscriptionPlan.update({ where: { id: plan.id }, data: { iyzicoPricingPlanRef: ref } });
    console.log(`✅ ${plan.name}: ${ref}`);
  }
}

main()
  .catch((e) => {
    console.error("❌ Hata:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
