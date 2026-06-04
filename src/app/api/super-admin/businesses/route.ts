import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import bcrypt from "bcryptjs";

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
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { success: false, error: "Yetkisiz erişim" },
        { status: 403 }
      );
    }

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
  } catch (error) {
    console.error("Super Admin businesses data error:", error);
    return NextResponse.json(
      { success: false, error: "Sunucu hatası" },
      { status: 500 }
    );
  }
}

// POST — Yeni işletme oluştur (işletme adı + admin hesabı)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { success: false, error: "Yetkisiz erişim" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, email, phone, address, adminName, adminEmail, adminPassword } = body;

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

    // ✅ Admin şifre minimum uzunluk
    if (String(adminPassword).length < 8) {
      return NextResponse.json(
        { success: false, error: "Admin şifresi en az 8 karakter olmalıdır" },
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
    const hashedPassword = await bcrypt.hash(String(adminPassword), 10);

    const business = await prisma.$transaction(async (tx) => {
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

      await tx.user.create({
        data: {
          businessId: newBusiness.id,
          name: adminName ? String(adminName).trim() : `${String(name).trim()} Admin`,
          email: normalizedAdminEmail,
          password: hashedPassword,
          role: "ADMIN",
          isActive: true,
        },
      });

      return newBusiness;
    });

    return NextResponse.json(
      {
        success: true,
        business,
        message: "İşletme ve admin hesabı başarıyla oluşturuldu",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Yeni işletme oluşturma hatası:", error);
    return NextResponse.json(
      { success: false, error: "Sunucu hatası" },
      { status: 500 }
    );
  }
}