/**
 * Abonelik planlarını oluşturur / günceller.
 *
 *   node prisma/seed-plans.cjs                → planları oluşturur, varsa fiyat/limitleri günceller
 *   node prisma/seed-plans.cjs --create-only  → sadece eksik planları oluşturur (Render build'i bunu kullanır;
 *                                               Super Admin'den değiştirilen fiyatlar korunur)
 *
 * Düz Node.js — tsx/devDependency gerektirmez, production kurulumunda da çalışır.
 */

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const createOnly = process.argv.includes("--create-only");

// Fiyatlar ve limitler örnektir. null limit = sınırsız
const PLANS = [
  {
    code: "starter",
    name: "Başlangıç",
    description: "Küçük kafe ve restoranlar için",
    monthlyPrice: 299,
    maxTables: 10,
    maxWaiters: 3,
    maxProducts: 50,
    hasReports: false,
    hasPayments: false,
    hasLocationLock: false,
    sortOrder: 1,
  },
  {
    code: "pro",
    name: "Profesyonel",
    description: "Büyüyen işletmeler için",
    monthlyPrice: 599,
    maxTables: 30,
    maxWaiters: 10,
    maxProducts: 200,
    hasReports: true,
    hasPayments: true,
    hasLocationLock: true,
    sortOrder: 2,
  },
  {
    code: "business",
    name: "Kurumsal",
    description: "Çok masalı büyük işletmeler için",
    monthlyPrice: 1199,
    maxTables: null,
    maxWaiters: null,
    maxProducts: null,
    hasReports: true,
    hasPayments: true,
    hasLocationLock: true,
    sortOrder: 3,
  },
];

async function main() {
  for (const plan of PLANS) {
    const existing = await prisma.subscriptionPlan.findUnique({ where: { code: plan.code } });

    if (existing && createOnly) {
      console.log(`↪️  Plan zaten var, dokunulmadı: ${plan.code}`);
      continue;
    }

    await prisma.subscriptionPlan.upsert({
      where: { code: plan.code },
      update: plan,
      create: { ...plan, trialDays: 14, isActive: true },
    });
    console.log(`✅ Plan ${existing ? "güncellendi" : "oluşturuldu"}: ${plan.code} (${plan.name})`);
  }
  // Not: Aboneliği olmayan mevcut işletmelere dokunulmaz —
  // subscription-guard bunlara varsayılan limitleri uygular.
}

main()
  .catch((e) => {
    console.error("❌ Plan seed hatası:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
