import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { businessId: string; tableNumber: string } }
) {
  try {
    const { businessId, tableNumber } = params;

    // İşletme bilgisi
    const business = await prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!business || !business.isActive) {
      return NextResponse.json({ error: "İşletme bulunamadı veya aktif değil" }, { status: 404 });
    }

    // ✅ Silinen masa kontrolü
    const table = await prisma.table.findFirst({
      where: {
        businessId,
        tableNumber,
        isDeleted: false,
      },
    });

    if (!table) {
      return NextResponse.json(
        { error: "Bu QR kod artık geçerli değil. Lütfen işletme personelinden yeni QR kod isteyin." },
        { status: 404 }
      );
    }

    if (!table.isActive) {
      return NextResponse.json(
        { error: "Bu masa şu anda aktif değil." },
        { status: 403 }
      );
    }

    // ✅ Kategoriler ve ürünler — silinen ürünleri gösterme
    const categories = await prisma.category.findMany({
      where: { businessId, isActive: true },
      orderBy: { sortOrder: "asc" },
      include: {
        products: {
          where: { isDeleted: false }, // ✅ Silinen ürünleri filtrele
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    // ✅ Popüler ürünler — silinen ürünleri gösterme
    const popularProducts = await prisma.product.findMany({
      where: {
        businessId,
        isPopular: true,
        isAvailable: true,
        stockStatus: "IN_STOCK",
        isDeleted: false, // ✅ Silinen ürünleri filtrele
      },
      take: 6,
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json({
      business,
      table,
      categories,
      popularProducts,
    });
  } catch (error) {
    console.error("Menü yükleme hatası:", error);
    return NextResponse.json({ error: "Menü yüklenirken bir hata oluştu" }, { status: 500 });
  }
}
