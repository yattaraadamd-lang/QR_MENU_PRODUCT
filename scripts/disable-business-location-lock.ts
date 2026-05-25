/**
 * Tüm işletmelerde konum kilidini kapatır (latitude/longitude sıfırlanır).
 * Eski Vercel sürümünde "işletme içerisinde yapılabilir" hatasını anında keser.
 *
 * Kullanım: npx tsx scripts/disable-business-location-lock.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.business.updateMany({
    data: {
      latitude: null,
      longitude: null,
    },
  });
  console.log(`✅ ${result.count} işletmede konum koordinatları temizlendi.`);
  console.log("Sipariş artık konum kontrolüne takılmamalı (eski API dahil).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
