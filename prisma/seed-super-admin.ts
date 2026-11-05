import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  SUPER_ADMIN_BCRYPT_COST,
  ensureSuperAdmin,
  isValidAccountPassword,
  isValidEmail,
  normalizeEmail,
} from "./super-admin";

/**
 * Süper admin oluşturur ya da parolasını yeniler.
 *
 *   SUPER_ADMIN_EMAIL ve SUPER_ADMIN_PASSWORD zorunludur; varsayılan değer yoktur.
 *   Parola 12-72 karakter, en az bir harf ve bir rakam. Hiçbir yere yazdırılmaz.
 */

const prisma = new PrismaClient();

async function main() {
  const email = normalizeEmail(process.env.SUPER_ADMIN_EMAIL ?? "");
  const password = process.env.SUPER_ADMIN_PASSWORD ?? "";

  if (!isValidEmail(email)) throw new Error("SUPER_ADMIN_EMAIL geçerli bir e-posta olmalı.");
  if (!isValidAccountPassword(password)) {
    throw new Error("SUPER_ADMIN_PASSWORD 12-72 karakter olmalı ve en az bir harf ile bir rakam içermeli.");
  }

  const passwordHash = await bcrypt.hash(password, SUPER_ADMIN_BCRYPT_COST);
  const user = await ensureSuperAdmin(prisma, { email, passwordHash });
  console.log(`✅ Süper admin hazır: ${user.email}`);
}

main()
  .catch((e) => {
    console.error(`❌ ${e.message}`);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
