import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/public/[businessSlug]/categories - Public kategoriler
export async function GET(
  request: NextRequest,
  { params }: { params: { businessSlug: string } }
) {
  try {
    const business = await prisma.business.findUnique({
      where: { slug: params.businessSlug, isActive: true },
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
      include: {
        products: {
          where: { isAvailable: true },
          orderBy: { sortOrder: "asc" },
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
