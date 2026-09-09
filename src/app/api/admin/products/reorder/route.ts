import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, getBusinessIdFromSession } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/products/reorder
 * Toplu ürün sıralama güncellemesi
 */
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (!authResult.success) return authResult.response;

    const businessId = getBusinessIdFromSession(authResult.session);
    if (!businessId) {
      return NextResponse.json({ error: "İşletme bulunamadı" }, { status: 403 });
    }

    const body = await request.json();
    const { items } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Geçersiz sıralama verisi" }, { status: 400 });
    }

    // Maksimum 200 ürün sıralanabilir
    if (items.length > 200) {
      return NextResponse.json({ error: "Maksimum 200 ürün sıralanabilir" }, { status: 400 });
    }

    // Validate format: [{id, sortOrder}]
    for (const item of items) {
      if (!item.id || typeof item.sortOrder !== "number" || item.sortOrder < 0) {
        return NextResponse.json({ error: "Geçersiz sıralama formatı" }, { status: 400 });
      }
    }

    // Transaction ile güncelle
    await prisma.$transaction(
      items.map((item: { id: string; sortOrder: number }) =>
        prisma.product.update({
          where: { id: item.id, businessId },
          data: { sortOrder: item.sortOrder },
        })
      )
    );

    return NextResponse.json({ message: "Sıralama güncellendi", count: items.length });
  } catch (error: any) {
    console.error("Ürün sıralama hatası:", error?.message);
    return NextResponse.json({ error: "Sıralama güncellenirken hata oluştu" }, { status: 500 });
  }
}
