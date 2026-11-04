import { Prisma, UserRole } from "@prisma/client";

/** User.businessId zorunlu olduğu için süper admin bu işletmeye bağlıdır */
export const PLATFORM_BUSINESS_ID = "platform-business";

export const SUPER_ADMIN_BCRYPT_COST = 12;

/** NextAuth girişi e-postayı küçültüp kırparak arar; başka biçimde saklanan hesap giremez */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

/** Kayıt ve personel uçlarıyla aynı kural (src/app/api/auth/signup/route.ts) */
export function isValidAccountPassword(password: string): boolean {
  return password.length >= 12 && password.length <= 72 && /[a-zA-Z]/.test(password) && /[0-9]/.test(password);
}

export async function ensureSuperAdmin(
  db: Prisma.TransactionClient,
  { email, passwordHash }: { email: string; passwordHash: string },
) {
  await db.business.upsert({
    where: { id: PLATFORM_BUSINESS_ID },
    update: {},
    create: { id: PLATFORM_BUSINESS_ID, name: "QR Menu Platform", slug: "platform" },
  });

  const fields = {
    businessId: PLATFORM_BUSINESS_ID,
    password: passwordHash,
    role: UserRole.SUPER_ADMIN,
    isActive: true,
    deletedAt: null,
  };
  return db.user.upsert({
    where: { email },
    update: fields,
    create: { email, name: "Süper Admin", ...fields },
  });
}
