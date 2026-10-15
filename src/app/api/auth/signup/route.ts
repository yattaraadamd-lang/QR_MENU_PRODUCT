import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { validateBody } from "@/lib/validation";
import { rateLimit, getClientIp, RateLimitPresets, createRateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const signupSchema = z.object({
  businessName: z.string().trim().min(2, "İşletme adı en az 2 karakter olmalı").max(100),
  name: z.string().trim().min(2, "Ad soyad en az 2 karakter olmalı").max(100),
  email: z.string().trim().toLowerCase().email("Geçerli bir e-posta girin"),
  password: z.string().min(8, "Şifre en az 8 karakter olmalı").max(100),
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
    const rl = rateLimit({ ...RateLimitPresets.LOGIN, identifier: `signup_${getClientIp(request)}` });
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
    const hashedPassword = await bcrypt.hash(password, 10);
    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + plan.trialDays * 24 * 60 * 60 * 1000);

    const business = await prisma.$transaction(async (tx) => {
      const business = await tx.business.create({
        data: { name: businessName, slug, email, phone: phone || null },
      });

      await tx.user.create({
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

      return business;
    });

    return NextResponse.json(
      {
        message: "Hesabınız oluşturuldu",
        business: { id: business.id, name: business.name, slug: business.slug },
        trialEndsAt,
      },
      { status: 201 }
    );
  } catch (error: any) {
    // Eşzamanlı aynı e-posta / slug
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "Bu e-posta adresi zaten kullanılıyor" }, { status: 400 });
    }
    console.error("İşletme kaydı hatası:", error);
    return NextResponse.json({ error: "Kayıt sırasında bir hata oluştu" }, { status: 500 });
  }
}
