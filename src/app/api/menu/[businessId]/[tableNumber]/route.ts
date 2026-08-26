import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; tableNumber: string }> }
) {
  try {
    const params = await context.params;
    const { businessId, tableNumber } = params;

    // ✅ PERF: İşletme + masa sorgularını paralel çalıştır
    const [business, table] = await Promise.all([
      prisma.business.findUnique({
        where: { id: businessId },
        select: {
          id: true,
          name: true,
          description: true,
          logo: true,
          phone: true,
          isActive: true,
        },
      }),
      prisma.table.findFirst({
        where: {
          businessId,
          tableNumber,
          isDeleted: false,
        },
        select: {
          id: true,
          tableNumber: true,
          tableName: true,
          status: true,
          isActive: true,
        },
      }),
    ]);

    if (!business || !business.isActive) {
      return NextResponse.json({ error: "İşletme bulunamadı veya aktif değil" }, { status: 404 });
    }

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

    // ✅ PERF: Kategoriler, popüler ürünler ve oturum sorgularını paralel çalıştır
    const [categories, popularProducts, activeTableSession] = await Promise.all([
      // Kategoriler ve ürünler — silinen ürünleri gösterme
      prisma.category.findMany({
        where: { businessId, isActive: true },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          icon: true,
          products: {
            where: { isDeleted: false },
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              name: true,
              description: true,
              ingredients: true,
              allergens: true,
              price: true,
              image: true,
              isAvailable: true,
              stockStatus: true,
              isPopular: true,
            },
          },
        },
      }),
      // Popüler ürünler — silinen ürünleri gösterme
      prisma.product.findMany({
        where: {
          businessId,
          isPopular: true,
          isAvailable: true,
          stockStatus: "IN_STOCK",
          isDeleted: false,
        },
        take: 6,
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          image: true,
          isAvailable: true,
          stockStatus: true,
          isPopular: true,
        },
      }),
      // Aktif masa oturumu var mı?
      prisma.tableSession.findFirst({
        where: { tableId: table.id, businessId, status: "ACTIVE" },
        select: { id: true },
      }),
    ]);

    const response = NextResponse.json({
      business,
      table,
      categories,
      popularProducts,
      tableSessionActive: !!activeTableSession,
      activeTableSessionId: activeTableSession?.id ?? null,
    });

    // ✅ PERF: Menü verisi kısa süreli cache'lenebilir (CDN/browser)
    response.headers.set("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");

    return response;
  } catch (error) {
    console.error("Menü yükleme hatası:", error);
    return NextResponse.json({ error: "Menü yüklenirken bir hata oluştu" }, { status: 500 });
  }
}
