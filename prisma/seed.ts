import { PrismaClient } from "@prisma/client";
import { DEMO_EMAILS, hashDemoPasswords, syncDemoBusiness } from "./demo-data";

const prisma = new PrismaClient();

// ✅ P0-08 FIX: Production safety guard with DEMO_MODE support
function checkProductionSafety() {
  const isDemoMode = process.env.DEMO_MODE === "true";
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction && !isDemoMode) {
    throw new Error(
      "❌ SECURITY: Demo seed cannot run in production without DEMO_MODE=true.\n" +
      "Set DEMO_MODE=true in environment variables to enable demo accounts for E2E testing.\n" +
      "⚠️  WARNING: This will create accounts with weak passwords!"
    );
  }

  if (isProduction && isDemoMode) {
    console.warn("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.warn("⚠️  DEMO MODE ENABLED IN PRODUCTION!");
    console.warn("⚠️  Creating demo accounts with WEAK passwords!");
    console.warn("⚠️  For E2E testing and demonstration only!");
    console.warn("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  } else {
    console.warn("⚠️  Running DEMO seed with weak passwords - development only!");
  }
}

async function main() {
  checkProductionSafety();

  console.log("🌱 Seed başlatılıyor...");

  const passwordHashes = await hashDemoPasswords();
  await prisma.$transaction((tx) => syncDemoBusiness(tx, passwordHashes), { timeout: 60_000 });

  console.log("🎉 Demo işletmesi tanımıyla eşitlendi.");
  console.log(`Hesaplar: ${DEMO_EMAILS.join(", ")} (parolalar: prisma/demo-data.ts)`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
