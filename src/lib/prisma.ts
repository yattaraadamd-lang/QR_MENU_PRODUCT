import "server-only";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// ✅ PERF: Üretimde sadece warn/error logla, dev'de opsiyonel query log
const logOptions: ConstructorParameters<typeof PrismaClient>[0] =
  process.env.NODE_ENV === "production"
    ? { log: ["warn", "error"] }
    : process.env.PRISMA_LOG_QUERIES === "true"
      ? { log: ["query", "warn", "error"] }
      : { log: ["warn", "error"] };

// Canlı veritabanı uzak ve yavaş anları oluyor: Prisma'nın varsayılanı (2 sn bekleme, 5 sn süre)
// birkaç sorguluk transaction'ı bile P2028 ile düşürüp isteği 500'e çeviriyordu.
// Tek tek transaction'lar yine kendi değerlerini verebilir.
const prismaClientOptions: ConstructorParameters<typeof PrismaClient>[0] = {
  ...logOptions,
  transactionOptions: { maxWait: 10_000, timeout: 20_000 },
};

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient(prismaClientOptions);

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
