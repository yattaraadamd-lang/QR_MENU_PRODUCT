import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, getBusinessIdFromSession } from "@/lib/tenant";
import { validateBody, updateCategorySchema, isValidCuid } from "@/lib/validation";

// PUT /api/admin/categories/[id] - Kategori güncelle
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // ✅ Authentication & Authorization
    const authResult = await requireAdmin();
    if (!authResult.success) return authResult.response;

    const businessId = getBusinessIdFromSession(authResult.session);

    // ✅ Validate category ID
    if (!isValidCuid(params.id)) {
      return NextResponse.json(
        { error: "Geçersiz kategori ID formatı" },
        { status: 400 }
      );
    }

    // ✅ Validate request body
    const body = await request.json();
    const validation = validateBody(updateCategorySchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // ✅ Verify category ownership
    const existing = await prisma.category.findFirst({
      where: { id: params.id, businessId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Kategori bulunamadı" },
        { status: 404 }
      );
    }

    // ✅ Update category with validated data
    const category = await prisma.category.update({
      where: { id: params.id },
      data: validation.data,
      select: {
        id: true,
        name: true,
        icon: true,
        sortOrder: true,
        isActive: true,
      },
    });

    return NextResponse.json({ message: "Kategori güncellendi", category });
  } catch (error) {
    console.error("Kategori güncelleme hatası:", error);
    return NextResponse.json(
      { error: "Kategori güncellenirken bir hata oluştu" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/categories/[id] - Kategori sil
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // ✅ Authentication & Authorization
    const authResult = await requireAdmin();
    if (!authResult.success) return authResult.response;

    const businessId = getBusinessIdFromSession(authResult.session);

    // ✅ Validate category ID
    if (!isValidCuid(params.id)) {
      return NextResponse.json(
        { error: "Geçersiz kategori ID formatı" },
        { status: 400 }
      );
    }

    // ✅ Verify category ownership and check for products
    const existing = await prisma.category.findFirst({
      where: { id: params.id, businessId },
      select: {
        id: true,
        _count: {
          select: { products: { where: { isDeleted: false } } },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Kategori bulunamadı" },
        { status: 404 }
      );
    }

    // ✅ Prevent deletion if category has products
    if (existing._count.products > 0) {
      return NextResponse.json(
        { error: `Bu kategoride ${existing._count.products} ürün bulunuyor. Önce ürünleri başka kategoriye taşıyın.` },
        { status: 400 }
      );
    }

    // ✅ Delete category
    await prisma.category.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ message: "Kategori silindi" });
  } catch (error) {
    console.error("Kategori silme hatası:", error);
    return NextResponse.json(
      { error: "Kategori silinirken bir hata oluştu" },
      { status: 500 }
    );
  }
}
