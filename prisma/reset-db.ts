import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
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
