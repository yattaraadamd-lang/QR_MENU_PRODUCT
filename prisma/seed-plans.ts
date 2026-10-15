import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Fiyatlar ve limitler örnektir — Super Admin panelinden veya burada güncelleyin.
// null limit = sınırsız
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
    await prisma.subscriptionPlan.upsert({
      where: { code: plan.code },
      update: plan,
      create: { ...plan, trialDays: 14, isActive: true },
    });
    console.log(`✅ Plan: ${plan.code} (${plan.name})`);
  }

  // Aboneliği hiç olmayan mevcut işletmelere 14 günlük deneme ver (SaaS öncesi kayıtlar)
  const starter = await prisma.subscriptionPlan.findUniqueOrThrow({ where: { code: "starter" } });
  const orphans = await prisma.business.findMany({
    where: { id: { not: "platform-business" }, businessSubscriptions: { none: {} } },
    select: { id: true, name: true },
  });
  const now = new Date();
  for (const business of orphans) {
    await prisma.businessSubscription.create({
      data: {
        businessId: business.id,
        planId: starter.id,
        status: "TRIAL",
        startedAt: now,
        trialEndsAt: new Date(now.getTime() + starter.trialDays * 24 * 60 * 60 * 1000),
      },
    });
    console.log(`🎁 Deneme başlatıldı: ${business.name}`);
  }
}

main()
  .catch((e) => {
    console.error("❌ Hata:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
