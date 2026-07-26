import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function addPartialUniqueIndexes() {
  console.log("Adding partial unique indexes...");

  try {
    // 1. Each table can have at most one ACTIVE TableSession
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "table_sessions_unique_active_per_table"
        ON "table_sessions" ("tableId")
        WHERE status = 'ACTIVE';
    `);
    console.log("✅ table_sessions_unique_active_per_table created");

    // 2. Each table can have at most one pending ORDER_REQUEST
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "service_requests_unique_pending_order_request"
        ON "service_requests" ("tableId")
        WHERE "requestType" = 'ORDER_REQUEST' AND status IN ('PENDING', 'SEEN');
    `);
    console.log("✅ service_requests_unique_pending_order_request created");

    console.log("\\nAll partial unique indexes created successfully! 🚀");
  } catch (error: any) {
    if (error.message?.includes("already exists")) {
      console.log("Indexes already exist, skipping.");
    } else {
      console.error("Error creating indexes:", error);
      process.exit(1);
    }
  } finally {
    await prisma.$disconnect();
  }
}

addPartialUniqueIndexes();
