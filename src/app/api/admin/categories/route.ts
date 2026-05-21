import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, getBusinessIdFromSession } from "@/lib/tenant";
import { validateBody, createCategorySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// GET /api/admin/categories - Kategorileri listele
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (!authResult.success) return authResult.response;

    const businessId = getBusinessIdFromSession(authResult.session);
    
    const categories = await prisma.category.findMany({
      where: { businessId, isActive: true },
      select: {
        id: true,
        name: true,
        icon: true,
        sortOrder: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: { products: true },
        },
      },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json({ categories });
  } catch (error) {
    console.error("Kategori listeleme hatası:", error);
    return NextResponse.json(
      { error: "Kategoriler yüklenirken bir hata oluştu" },
      { status: 500 }
    );
  }
}

// POST /api/admin/categories - Kategori oluştur
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (!authResult.success) return authResult.response;

    const businessId = getBusinessIdFromSession(authResult.session);
    const body = await request.json();

    // Validation
    const validation = validateBody(createCategorySchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const category = await prisma.category.create({
      data: {
        businessId,
        ...validation.data,
      },
      select: {
        id: true,
        name: true,
        icon: true,
        sortOrder: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      { message: "Kategori oluşturuldu", category },
      { status: 201 }
    );
  } catch (error) {
    console.error("Kategori oluşturma hatası:", error);
    return NextResponse.json(
      { error: "Kategori oluşturulurken bir hata oluştu" },
      { status: 500 }
    );
  }
}
