import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, getBusinessIdFromSession } from "@/lib/tenant";
import { withApiHandler, parseJson } from "@/lib/api/handler";
import { categoryReorderSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/categories/reorder
 * Toplu kategori sıralama güncellemesi
 */
export const PATCH = withApiHandler("PATCH /api/admin/categories/reorder", handlePatch);

async function handlePatch(request: NextRequest) {
  const authResult = await requireAdmin();
  if (!authResult.success) return authResult.response;

  const businessId = getBusinessIdFromSession(authResult.session);
  if (!businessId) {
    return NextResponse.json({ error: "İşletme bulunamadı" }, { status: 403 });
  }

  const { items } = await parseJson(request, categoryReorderSchema);

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
}
