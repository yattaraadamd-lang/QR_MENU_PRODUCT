import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, getBusinessIdFromSession } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/categories/reorder
 * Toplu kategori sıralama güncellemesi
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

    if (items.length > 100) {
      return NextResponse.json({ error: "Maksimum 100 kategori sıralanabilir" }, { status: 400 });
    }

    for (const item of items) {
      if (!item.id || typeof item.sortOrder !== "number" || item.sortOrder < 0) {
        return NextResponse.json({ error: "Geçersiz sıralama formatı" }, { status: 400 });
      }
    }

    await prisma.$transaction(
      items.map((item: { id: string; sortOrder: number }) =>
        prisma.category.update({
          where: { id: item.id, businessId },
          data: { sortOrder: item.sortOrder },
        })
      )
    );

    return NextResponse.json({ message: "Kategori sıralaması güncellendi", count: items.length });
  } catch (error: any) {
    console.error("Kategori sıralama hatası:", error?.message);
    return NextResponse.json({ error: "Sıralama güncellenirken hata oluştu" }, { status: 500 });
  }
}
