import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export type PublicMenuResult =
  | { ok: true; body: string; etag: string }
  | { ok: false; status: number; error: string };

/**
 * Kimliksiz masa menüsü (müşteri QR akışı). API rotası (/api/menu/...) ve sunucuda
 * çizilen menü sayfası aynı gövdeyi ve aynı ETag'i üretir: sayfanın ilk HTML'iyle
 * gelen menü, istemcinin ilk periyodik yenilemesinde gövdesiz 304 alır.
 */
export async function getPublicMenu(businessId: string, tableNumber: string): Promise<PublicMenuResult> {
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
    return { ok: false, status: 404, error: "İşletme bulunamadı veya aktif değil" };
  }
  if (!table) {
    return { ok: false, status: 404, error: "Bu QR kod artık geçerli değil. Lütfen işletme personelinden yeni QR kod isteyin." };
  }
  if (!table.isActive) {
    return { ok: false, status: 403, error: "Bu masa şu anda aktif değil." };
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
    // 🔒 SECURITY: Kimliksiz uç — iç masa oturumu ID'si döndürülmez (istemci kullanmıyor)
  });

  // ETag gövdenin özeti: stok, fiyat, masa durumu ve tableSessionActive dahil her alanı
  // kapsar (updatedAt tabanlı bir ETag silinen kategoriyi kaçırırdı)
  const etag = `W/"${crypto.createHash("sha1").update(body).digest("base64url")}"`;
  return { ok: true, body, etag };
}
