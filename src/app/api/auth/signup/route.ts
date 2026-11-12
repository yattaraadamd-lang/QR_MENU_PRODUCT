import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { SIGNUP_BUSINESS_NAME_LIMITS } from "@/contracts/business";
import { PASSWORD_LIMITS, PERSON_NAME_LIMITS } from "@/contracts/users";
import { prisma } from "@/lib/prisma";
import { validateBody } from "@/lib/validation";
import { rateLimit, getClientIp, UNIFIED_RATE_LIMITS, createRateLimitResponse } from "@/lib/unified-rate-limit";
import { createAuditLog, AuditActions } from "@/lib/services/audit-log.service";
import { errorFields } from "@/lib/error-fields";

export const dynamic = "force-dynamic";

const signupSchema = z.object({
  businessName: z
    .string()
    .trim()
    .min(SIGNUP_BUSINESS_NAME_LIMITS.min, `İşletme adı en az ${SIGNUP_BUSINESS_NAME_LIMITS.min} karakter olmalı`)
    .max(SIGNUP_BUSINESS_NAME_LIMITS.max),
  name: z
    .string()
    .trim()
    .min(PERSON_NAME_LIMITS.min, `Ad soyad en az ${PERSON_NAME_LIMITS.min} karakter olmalı`)
    .max(PERSON_NAME_LIMITS.max),
  email: z.string().trim().toLowerCase().email("Geçerli bir e-posta girin").max(254),
  // Garson kaydıyla aynı politika: PASSWORD_LIMITS, en az 1 harf + 1 rakam
  password: z
    .string()
    .min(PASSWORD_LIMITS.min, `Şifre en az ${PASSWORD_LIMITS.min} karakter olmalı`)
    .max(PASSWORD_LIMITS.max, `Şifre en fazla ${PASSWORD_LIMITS.max} karakter olabilir`)
    .regex(/[a-zA-Z]/, "Şifre en az 1 harf içermeli")
    .regex(/[0-9]/, "Şifre en az 1 rakam içermeli"),
  phone: z.string().trim().max(30).optional().nullable(),
  planCode: z.string().trim().max(50).optional().nullable(),
});

const TR_MAP: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" };

function slugify(input: string) {
  return (
    input
      .toLocaleLowerCase("tr-TR")
      .replace(/[çğıöşü]/g, (c) => TR_MAP[c])
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50) || "isletme"
  );
}

async function uniqueSlug(base: string) {
  let slug = base;
  for (let i = 2; await prisma.business.findUnique({ where: { slug }, select: { id: true } }); i++) {
    slug = `${base}-${i}`;
  }
  return slug;
}

// POST /api/auth/signup — İşletme sahibi kendi hesabını açar
// İşletme + ADMIN kullanıcı + TRIAL abonelik tek transaction'da oluşturulur.
export async function POST(request: NextRequest) {
  try {
    const rl = await rateLimit({ ...UNIFIED_RATE_LIMITS.REGISTER, identifier: `signup_${getClientIp(request)}` });
    if (!rl.success) return createRateLimitResponse(rl);

    const validation = validateBody(signupSchema, await request.json());
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const { businessName, name, email, password, phone, planCode } = validation.data;

    const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existingUser) {
      return NextResponse.json({ error: "Bu e-posta adresi zaten kullanılıyor" }, { status: 400 });
    }

    // Seçilen plan, yoksa en ucuz aktif plan ile deneme başlar
    const plan =
      (planCode &&
        (await prisma.subscriptionPlan.findFirst({ where: { code: planCode, isActive: true } }))) ||
      (await prisma.subscriptionPlan.findFirst({
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { monthlyPrice: "asc" }],
      }));

    if (!plan) {
      console.error("Kayıt: aktif abonelik planı yok. `npm run db:seed:plans` çalıştırın.");
      return NextResponse.json(
        { error: "Kayıt şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin." },
        { status: 503 }
      );
    }

    const slug = await uniqueSlug(slugify(businessName));
    const hashedPassword = await bcrypt.hash(password, 12);
    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + plan.trialDays * 24 * 60 * 60 * 1000);

    const { business, userId } = await prisma.$transaction(async (tx) => {
      const business = await tx.business.create({
        data: { name: businessName, slug, email, phone: phone || null },
      });

      const user = await tx.user.create({
        data: {
          businessId: business.id,
          name,
          email,
          password: hashedPassword,
          phone: phone || null,
          role: "ADMIN",
        },
      });

      await tx.businessSubscription.create({
        data: {
          businessId: business.id,
          planId: plan.id,
          status: "TRIAL",
          startedAt: now,
          trialEndsAt,
        },
      });

      return { business, userId: user.id };
    });

    createAuditLog({
      businessId: business.id,
      actorUserId: userId,
      actorRole: "ADMIN",
      action: AuditActions.USER_REGISTERED,
      entityType: "Business",
      entityId: business.id,
      metadata: { selfSignup: true, planId: plan.id },
    });

    return NextResponse.json(
      {
        message: "Hesabınız oluşturuldu",
        business: { id: business.id, name: business.name, slug: business.slug },
        trialEndsAt,
      },
      { status: 201 }
    );
  } catch (error) {
    // Eşzamanlı aynı e-posta / slug
    if (errorFields(error).code === "P2002") {
      return NextResponse.json({ error: "Bu e-posta adresi zaten kullanılıyor" }, { status: 400 });
    }
    console.error("İşletme kaydı hatası:", error);
    return NextResponse.json({ error: "Kayıt sırasında bir hata oluştu" }, { status: 500 });
  }
}
