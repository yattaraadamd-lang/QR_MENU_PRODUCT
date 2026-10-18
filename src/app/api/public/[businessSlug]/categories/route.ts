import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/public/[businessSlug]/categories - Public kategoriler
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessSlug: string }> }
) {
  try {
    const params = await context.params;
    // ✅ SECURITY: Yalnız herkese açık alanlar — konum, iç kayıt alanları vb. dönmez
    const business = await prisma.business.findUnique({
      where: { slug: params.businessSlug, isActive: true },
      select: { id: true, name: true, slug: true, description: true, logo: true },
    });

    if (!business) {
      return NextResponse.json(
        { error: "İşletme bulunamadı" },
        { status: 404 }
      );
    }

    const categories = await prisma.category.findMany({
      where: { businessId: business.id, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        icon: true,
        products: {
          // ✅ Silinmiş ürünler gösterilmez
          where: { isAvailable: true, isDeleted: false },
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            name: true,
            description: true,
            ingredients: true,
            allergens: true,
            price: true,
            image: true,
            stockStatus: true,
            isPopular: true,
          },
        },
      },
    });

    return NextResponse.json({ categories, business });
  } catch (error) {
    console.error("Kategori listeleme hatası:", error);
    return NextResponse.json(
      { error: "Kategoriler yüklenirken bir hata oluştu" },
      { status: 500 }
    );
  }
}
