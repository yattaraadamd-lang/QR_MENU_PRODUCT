import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, getBusinessIdFromSession, verifyResourceOwnership } from "@/lib/tenant";
import { validateBody, updateProductSchema, isValidCuid } from "@/lib/validation";

// PUT /api/admin/products/[id] - Ürün güncelle
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // ✅ Authentication & Authorization
    const authResult = await requireAdmin();
    if (!authResult.success) return authResult.response;

    const businessId = getBusinessIdFromSession(authResult.session);

    // ✅ Validate product ID
    if (!isValidCuid(params.id)) {
      return NextResponse.json(
        { error: "Geçersiz ürün ID formatı" },
        { status: 400 }
      );
    }

    // ✅ Validate request body
    const body = await request.json();
    const validation = validateBody(updateProductSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // ✅ Verify product ownership
    const existing = await prisma.product.findFirst({
      where: { id: params.id, businessId, isDeleted: false },
      select: { id: true, categoryId: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Ürün bulunamadı" },
        { status: 404 }
      );
    }

    // ✅ If categoryId is being changed, verify new category ownership
    if (validation.data.categoryId && validation.data.categoryId !== existing.categoryId) {
      const categoryOwned = await verifyResourceOwnership(
        "category",
        validation.data.categoryId,
        businessId
      );

      if (!categoryOwned) {
        return NextResponse.json(
          { error: "Geçersiz kategori" },
          { status: 400 }
        );
      }
    }

    // ✅ Update product with validated data
    const product = await prisma.product.update({
      where: { id: params.id },
      data: validation.data,
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        image: true,
        isAvailable: true,
        stockStatus: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({ message: "Ürün güncellendi", product });
  } catch (error) {
    console.error("Ürün güncelleme hatası:", error);
    return NextResponse.json(
      { error: "Ürün güncellenirken bir hata oluştu" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/products/[id] - Ürün sil (soft-delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // ✅ Authentication & Authorization
    const authResult = await requireAdmin();
    if (!authResult.success) return authResult.response;

    const businessId = getBusinessIdFromSession(authResult.session);

    // ✅ Validate product ID
    if (!isValidCuid(params.id)) {
      return NextResponse.json(
        { error: "Geçersiz ürün ID formatı" },
        { status: 400 }
      );
    }

    // ✅ Verify product ownership
    const existing = await prisma.product.findFirst({
      where: { id: params.id, businessId, isDeleted: false },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Ürün bulunamadı" }, { status: 404 });
    }

    // ✅ Soft-delete: fiziksel silme yerine işaretle
    await prisma.product.update({
      where: { id: params.id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        isAvailable: false, // Menüden de kaldır
      },
    });

    return NextResponse.json({ message: "Ürün silindi" });
  } catch (error) {
    console.error("Ürün silme hatası:", error);
    return NextResponse.json({ error: "Ürün silinirken bir hata oluştu" }, { status: 500 });
  }
}
