import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { createAuditLog, auditRequestContext, AuditActions } from "@/lib/services/audit-log.service";
import bcrypt from "bcryptjs";
import { withApiHandler, parseJson } from "@/lib/api/handler";
import { superAdminBusinessCreateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// ✅ Slug üretici: "Café Istanbul" → "cafe-istanbul"
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s")
    .replace(/ı/g, "i").replace(/ö/g, "o").replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 60);
}

// GET — Tüm işletmeleri listele
export const GET = withApiHandler("GET /api/super-admin/businesses", handleGet);

async function handleGet(request: NextRequest) {
  const { error, response } = await requireSuperAdmin();
  if (error) return response;

  const businesses = await prisma.business.findMany({
    include: {
      _count: {
        select: {
          tables: true,
          products: true,
        },
      },
      businessSubscriptions: {
        where: { status: "ACTIVE" },
        include: { plan: true },
        take: 1,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return NextResponse.json({ success: true, businesses });
}

// POST — Yeni işletme oluştur (işletme adı + admin hesabı)
export const POST = withApiHandler("POST /api/super-admin/businesses", handlePost);

async function handlePost(request: NextRequest) {
  const { error, response, session } = await requireSuperAdmin();
  if (error) return response;

  const { name, email, phone, address, adminName, adminEmail, adminPassword } = await parseJson(
    request,
    superAdminBusinessCreateSchema
  );

  // Zorunlu alan kontrolü
  if (!name || !adminEmail || !adminPassword) {
    return NextResponse.json(
      { success: false, error: "İşletme adı, admin e-posta ve şifre zorunludur" },
      { status: 400 }
    );
  }

  // ✅ Admin e-posta normalize + format kontrolü
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const normalizedAdminEmail = String(adminEmail).trim().toLowerCase();
  if (!EMAIL_REGEX.test(normalizedAdminEmail)) {
    return NextResponse.json(
      { success: false, error: "Geçerli bir admin e-posta adresi giriniz" },
      { status: 400 }
    );
  }

  // ✅ SECURITY: Self-servis kayıt ve personel ile aynı politika (12-72, harf + rakam)
  // bcrypt 72 bayttan sonrasını yok saydığı için üst sınır da gerekli
  const passwordStr = String(adminPassword);
  if (
    passwordStr.length < 12 ||
    passwordStr.length > 72 ||
    !/[a-zA-Z]/.test(passwordStr) ||
    !/[0-9]/.test(passwordStr)
  ) {
    return NextResponse.json(
      { success: false, error: "Admin şifresi 12-72 karakter olmalı ve en az 1 harf ile 1 rakam içermelidir" },
      { status: 400 }
    );
  }

  // ✅ E-posta daha önce kullanılmış mı?
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedAdminEmail },
  });
  if (existingUser) {
    return NextResponse.json(
      { success: false, error: "Bu e-posta adresi zaten kullanılıyor" },
      { status: 400 }
    );
  }

  // ✅ Benzersiz slug üret (Türkçe karakter desteğiyle)
  let baseSlug = slugify(String(name).trim());
  let slug = baseSlug;
  let suffix = 1;
  while (await prisma.business.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${suffix++}`;
  }

  // ✅ İşletme + Admin kullanıcıyı aynı transaction'da oluştur
  const hashedPassword = await bcrypt.hash(passwordStr, 12);

  const { business, adminUserId } = await prisma.$transaction(async (tx) => {
    const newBusiness = await tx.business.create({
      data: {
        name: String(name).trim(),
        slug,
        email: email ? String(email).trim().toLowerCase() : null,
        phone: phone ? String(phone).trim() : null,
        address: address ? String(address).trim() : null,
        isActive: true,
      },
    });

    const adminUser = await tx.user.create({
      data: {
        businessId: newBusiness.id,
        name: adminName ? String(adminName).trim() : `${String(name).trim()} Admin`,
        email: normalizedAdminEmail,
        password: hashedPassword,
        role: "ADMIN",
        isActive: true,
      },
      select: { id: true },
    });

    return { business: newBusiness, adminUserId: adminUser.id };
  });

  createAuditLog({
    ...auditRequestContext(request.headers),
    businessId: business.id,
    actorUserId: session.user.id,
    actorRole: "SUPER_ADMIN",
    action: AuditActions.USER_CREATED,
    entityType: "User",
    entityId: adminUserId,
    after: { role: "ADMIN" },
    metadata: { withNewBusiness: true },
  });

  return NextResponse.json(
    {
      success: true,
      business,
      message: "İşletme ve admin hesabı başarıyla oluşturuldu",
    },
    { status: 201 }
  );
}