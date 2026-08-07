import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // ✅ SECURITY: Production safety guard
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "❌ SECURITY: reset-db.ts CANNOT run in production! " +
      "This script deletes ALL data. Use only in development/test."
    );
  }

  // Extra safety: detect production database URLs
  const dbUrl = process.env.DATABASE_URL || "";
  if (dbUrl.includes("supabase.co") || dbUrl.includes("render.com") || dbUrl.includes("neon.tech")) {
    throw new Error(
      "❌ SECURITY: DATABASE_URL appears to be a production/cloud database. " +
      "reset-db.ts is blocked. Use a local database for testing."
    );
  }

  console.log("🗑️  Veritabanı temizleniyor...\n");

  // Bağımlılık sırasına göre sil
  await prisma.notification.deleteMany({});
  console.log("✓ Notifications silindi");

  await prisma.orderItem.deleteMany({});
  console.log("✓ OrderItems silindi");

  await prisma.payment.deleteMany({});
  console.log("✓ Payments silindi");

  await prisma.order.deleteMany({});
  console.log("✓ Orders silindi");

  await prisma.serviceRequest.deleteMany({});
  console.log("✓ ServiceRequests silindi");

  await prisma.customerSession.deleteMany({});
  console.log("✓ CustomerSessions silindi");

  await prisma.waiterInvite.deleteMany({});
  console.log("✓ WaiterInvites silindi");

  await prisma.table.deleteMany({});
  console.log("✓ Tables silindi");

  await prisma.product.deleteMany({});
  console.log("✓ Products silindi");

  await prisma.category.deleteMany({});
  console.log("✓ Categories silindi");

  await prisma.businessSubscription.deleteMany({});
  console.log("✓ BusinessSubscriptions silindi");

  await prisma.user.deleteMany({});
  console.log("✓ Users silindi");

  await prisma.business.deleteMany({});
  console.log("✓ Businesses silindi");

  console.log("\n✅ Veritabanı tamamen temizlendi!");
}

main()
  .catch((e) => { console.error("❌ Hata:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
