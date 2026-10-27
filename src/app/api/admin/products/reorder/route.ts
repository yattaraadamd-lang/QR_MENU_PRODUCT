import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, getBusinessIdFromSession } from "@/lib/tenant";
import { withApiHandler, parseJson } from "@/lib/api/handler";
import { productReorderSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/products/reorder
 * Toplu ürün sıralama güncellemesi
 */
export const PATCH = withApiHandler("PATCH /api/admin/products/reorder", handlePatch);

async function handlePatch(request: NextRequest) {
  const authResult = await requireAdmin();
  if (!authResult.success) return authResult.response;

  const businessId = getBusinessIdFromSession(authResult.session);
  if (!businessId) {
    return NextResponse.json({ error: "İşletme bulunamadı" }, { status: 403 });
  }

  const { items } = await parseJson(request, productReorderSchema);

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
}
