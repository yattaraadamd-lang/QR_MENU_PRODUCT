import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// ✅ PERF: Üretimde sadece warn/error logla, dev'de opsiyonel query log
const prismaClientOptions: ConstructorParameters<typeof PrismaClient>[0] =
  process.env.NODE_ENV === "production"
    ? { log: ["warn", "error"] }
    : process.env.PRISMA_LOG_QUERIES === "true"
      ? { log: ["query", "warn", "error"] }
      : { log: ["warn", "error"] };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient(prismaClientOptions);

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
