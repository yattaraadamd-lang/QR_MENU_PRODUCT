import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** If-None-Match zayıf karşılaştırma (RFC 9110): W/ öneki yok sayılır; liste ve * desteklenir */
function etagMatches(header: string | null, etag: string): boolean {
  if (!header) return false;
  const bare = (tag: string) => tag.trim().replace(/^W\//, "");
  return header.split(",").some((tag) => tag.trim() === "*" || bare(tag) === bare(etag));
}

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

    const body = JSON.stringify({
      business,
      table,
      categories,
      popularProducts,
      tableSessionActive: !!activeTableSession,
      // 🔒 SECURITY: Kimliksiz endpoint — iç masa oturumu ID'si döndürülmez (istemci kullanmıyor)
    });

    // ✅ PERF: Menü sayfası periyodik yenilemede If-None-Match gönderir; değişmediyse gövdesiz
    // 304 döner. ETag gövdenin özeti: stok, fiyat, masa durumu ve tableSessionActive dahil her
    // alanı kapsar (updatedAt tabanlı bir ETag silinen kategoriyi kaçırırdı).
    // Cache-Control next.config'den gelir (/api → no-store, private); önbelleği istemci tutar.
    const etag = `W/"${crypto.createHash("sha1").update(body).digest("base64url")}"`;
    if (etagMatches(request.headers.get("if-none-match"), etag)) {
      return new NextResponse(null, { status: 304, headers: { ETag: etag } });
    }

    return new NextResponse(body, {
      headers: { "Content-Type": "application/json", ETag: etag },
    });
  } catch (error) {
    console.error("Menü yükleme hatası:", error);
    return NextResponse.json({ error: "Menü yüklenirken bir hata oluştu" }, { status: 500 });
  }
}
