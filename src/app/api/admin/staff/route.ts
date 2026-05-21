import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, getBusinessIdFromSession } from "@/lib/tenant";
import { validateBody, createStaffSchema } from "@/lib/validation";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

// GET /api/admin/staff - Garsonları listele
export async function GET(request: NextRequest) {
  try {
    // ✅ Authentication & Authorization
    const authResult = await requireAdmin();
    if (!authResult.success) return authResult.response;

    const businessId = getBusinessIdFromSession(authResult.session);

    // ✅ Tenant-safe query with minimal select
    const staff = await prisma.user.findMany({
      where: {
        businessId,
        role: "WAITER",
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        deletedAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100, // Limit results
    });

    return NextResponse.json({ staff });
  } catch (error) {
    console.error("Personel listeleme hatası:", error);
    return NextResponse.json(
      { error: "Personel listesi yüklenirken bir hata oluştu" },
      { status: 500 }
    );
  }
}

// POST /api/admin/staff - Yeni garson ekle
export async function POST(request: NextRequest) {
  try {
    // ✅ Authentication & Authorization
    const authResult = await requireAdmin();
    if (!authResult.success) return authResult.response;

    const businessId = getBusinessIdFromSession(authResult.session);

    // ✅ Validate request body
    const body = await request.json();
    const validation = validateBody(createStaffSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { name, email, password, role } = validation.data;

    // ✅ Check for duplicate email
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Bu e-posta adresi zaten kullanılıyor" },
        { status: 400 }
      );
    }

    // ✅ Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // ✅ Create staff with businessId from session
    const newStaff = await prisma.user.create({
      data: {
        businessId,
        name,
        email,
        password: hashedPassword,
        role,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      { message: "Personel başarıyla eklendi", staff: newStaff },
      { status: 201 }
    );
  } catch (error) {
    console.error("Personel ekleme hatası:", error);
    return NextResponse.json(
      { error: "Personel eklenirken bir hata oluştu" },
      { status: 500 }
    );
  }
}
