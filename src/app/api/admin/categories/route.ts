import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, getBusinessIdFromSession } from "@/lib/tenant";
import { createCategorySchema } from "@/lib/validation";
import { withApiHandler, parseJson } from "@/lib/api/handler";

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
export const POST = withApiHandler("POST /api/admin/categories", handlePost);

async function handlePost(request: NextRequest) {
  const authResult = await requireAdmin();
  if (!authResult.success) return authResult.response;

  const businessId = getBusinessIdFromSession(authResult.session);

  // Validation
  const input = await parseJson(request, createCategorySchema);

  const category = await prisma.category.create({
    data: {
      businessId,
      ...input,
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
}
