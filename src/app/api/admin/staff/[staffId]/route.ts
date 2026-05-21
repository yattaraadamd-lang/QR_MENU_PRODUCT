import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, getBusinessIdFromSession } from "@/lib/tenant";
import { validateBody, updateStaffSchema, isValidCuid } from "@/lib/validation";

// PUT /api/admin/staff/[staffId] - Garson güncelle
export async function PUT(
  request: NextRequest,
  { params }: { params: { staffId: string } }
) {
  try {
    // ✅ Authentication & Authorization
    const authResult = await requireAdmin();
    if (!authResult.success) return authResult.response;

    const businessId = getBusinessIdFromSession(authResult.session);

    // ✅ Validate staff ID
    if (!isValidCuid(params.staffId)) {
      return NextResponse.json(
        { error: "Geçersiz personel ID formatı" },
        { status: 400 }
      );
    }

    // ✅ Validate request body
    const body = await request.json();
    const validation = validateBody(updateStaffSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // ✅ Verify staff ownership
    const staff = await prisma.user.findFirst({
      where: { 
        id: params.staffId, 
        businessId, 
        role: { in: ["WAITER", "ADMIN"] }
      },
      select: { id: true, email: true },
    });

    if (!staff) {
      return NextResponse.json(
        { error: "Personel bulunamadı" },
        { status: 404 }
      );
    }

    // ✅ If email is being changed, check for duplicates
    if (validation.data.email && validation.data.email !== staff.email) {
      const duplicate = await prisma.user.findUnique({
        where: { email: validation.data.email },
        select: { id: true },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: "Bu e-posta adresi zaten kullanılıyor" },
          { status: 400 }
        );
      }
    }

    // ✅ Update staff with validated data
    const updatedStaff = await prisma.user.update({
      where: { id: params.staffId },
      data: validation.data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      message: "Personel güncellendi",
      staff: updatedStaff,
    });
  } catch (error) {
    console.error("Personel güncelleme hatası:", error);
    return NextResponse.json(
      { error: "Personel güncellenirken bir hata oluştu" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/staff/[staffId] - Garson sil (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { staffId: string } }
) {
  try {
    // ✅ Authentication & Authorization
    const authResult = await requireAdmin();
    if (!authResult.success) return authResult.response;

    const businessId = getBusinessIdFromSession(authResult.session);

    // ✅ Validate staff ID
    if (!isValidCuid(params.staffId)) {
      return NextResponse.json(
        { error: "Geçersiz personel ID formatı" },
        { status: 400 }
      );
    }

    // ✅ Verify staff ownership
    const staff = await prisma.user.findFirst({
      where: { 
        id: params.staffId, 
        businessId, 
        role: { in: ["WAITER", "ADMIN"] }
      },
      select: { id: true, role: true },
    });

    if (!staff) {
      return NextResponse.json(
        { error: "Personel bulunamadı" },
        { status: 404 }
      );
    }

    // ✅ Prevent self-deletion
    if (params.staffId === authResult.session.userId) {
      return NextResponse.json(
        { error: "Kendi hesabınızı silemezsiniz" },
        { status: 400 }
      );
    }

    // ✅ Soft delete: deactivate and mark as deleted
    await prisma.user.update({
      where: { id: params.staffId },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });

    return NextResponse.json({
      message: "Personel başarıyla silindi",
    });
  } catch (error) {
    console.error("Personel silme hatası:", error);
    return NextResponse.json(
      { error: "Personel silinirken bir hata oluştu" },
      { status: 500 }
    );
  }
}
