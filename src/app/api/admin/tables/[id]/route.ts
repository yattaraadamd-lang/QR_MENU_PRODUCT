import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, getBusinessIdFromSession } from "@/lib/tenant";
import { validateBody, updateTableSchema, isValidCuid } from "@/lib/validation";

// PUT /api/admin/tables/[id] - Masa güncelle
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // ✅ Authentication & Authorization
    const authResult = await requireAdmin();
    if (!authResult.success) return authResult.response;

    const businessId = getBusinessIdFromSession(authResult.session);

    // ✅ Validate table ID
    if (!isValidCuid(params.id)) {
      return NextResponse.json(
        { error: "Geçersiz masa ID formatı" },
        { status: 400 }
      );
    }

    // ✅ Validate request body
    const body = await request.json();
    const validation = validateBody(updateTableSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // ✅ Verify table ownership
    const existing = await prisma.table.findFirst({
      where: { id: params.id, businessId, isDeleted: false },
      select: { id: true, tableNumber: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Masa bulunamadı" },
        { status: 404 }
      );
    }

    // ✅ If tableNumber is being changed, check for duplicates
    if (validation.data.tableNumber && validation.data.tableNumber !== existing.tableNumber) {
      const duplicate = await prisma.table.findFirst({
        where: {
          businessId,
          tableNumber: validation.data.tableNumber,
          isDeleted: false,
          id: { not: params.id },
        },
        select: { id: true },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: `${validation.data.tableNumber} numaralı masa zaten mevcut` },
          { status: 400 }
        );
      }
    }

    // ✅ Update table with validated data
    const table = await prisma.table.update({
      where: { id: params.id },
      data: validation.data,
      select: {
        id: true,
        tableNumber: true,
        tableName: true,
        status: true,
        isActive: true,
      },
    });

    return NextResponse.json({ message: "Masa güncellendi", table });
  } catch (error) {
    console.error("Masa güncelleme hatası:", error);
    return NextResponse.json(
      { error: "Masa güncellenirken bir hata oluştu" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/tables/[id] - Masa sil (soft-delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // ✅ Authentication & Authorization
    const authResult = await requireAdmin();
    if (!authResult.success) return authResult.response;

    const businessId = getBusinessIdFromSession(authResult.session);

    // ✅ Validate table ID
    if (!isValidCuid(params.id)) {
      return NextResponse.json(
        { error: "Geçersiz masa ID formatı" },
        { status: 400 }
      );
    }

    // ✅ Verify table ownership and check for active operations
    const existing = await prisma.table.findFirst({
      where: { id: params.id, businessId, isDeleted: false },
      select: {
        id: true,
        tableNumber: true,
        _count: {
          select: {
            orders: {
              where: { status: { in: ["PENDING", "ACCEPTED", "PREPARING"] } },
            },
            serviceRequests: {
              where: { status: { in: ["PENDING", "SEEN", "IN_PROGRESS"] } },
            },
            payments: {
              where: { status: "PENDING" },
            },
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Masa bulunamadı veya zaten silinmiş" },
        { status: 404 }
      );
    }

    // ✅ Prevent deletion if table has active operations
    if (existing._count.orders > 0) {
      return NextResponse.json(
        { error: "Bu masaya ait aktif sipariş olduğu için masa silinemez." },
        { status: 400 }
      );
    }

    if (existing._count.serviceRequests > 0) {
      return NextResponse.json(
        { error: "Bu masaya ait aktif hizmet talebi olduğu için masa silinemez." },
        { status: 400 }
      );
    }

    if (existing._count.payments > 0) {
      return NextResponse.json(
        { error: "Bu masaya ait açık ödeme talebi olduğu için masa silinemez." },
        { status: 400 }
      );
    }

    // ✅ Soft-delete table
    await prisma.table.update({
      where: { id: params.id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        qrToken: null,
        isActive: false,
      },
    });

    return NextResponse.json({ message: "Masa başarıyla silindi." });
  } catch (error) {
    console.error("Masa silme hatası:", error);
    return NextResponse.json(
      { error: "Masa silinirken bir hata oluştu" },
      { status: 500 }
    );
  }
}
