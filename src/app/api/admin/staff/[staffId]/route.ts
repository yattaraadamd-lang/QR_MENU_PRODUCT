import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, getBusinessIdFromSession } from "@/lib/tenant";
import { updateStaffSchema, isValidCuid } from "@/lib/validation";
import bcrypt from "bcryptjs";
import { createAuditLog, auditRequestContext, AuditActions } from "@/lib/services/audit-log.service";
import { withApiHandler, parseJson } from "@/lib/api/handler";

// PUT /api/admin/staff/[staffId] - Garson güncelle
export const PUT = withApiHandler("PUT /api/admin/staff/[staffId]", handlePut);

async function handlePut(
  request: NextRequest,
  context: { params: Promise<{ staffId: string }> }
) {
  const params = await context.params;
  
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
  const input = await parseJson(request, updateStaffSchema);

  // ✅ Verify staff ownership
  const staff = await prisma.user.findFirst({
    where: { 
      id: params.staffId, 
      businessId, 
      role: { in: ["WAITER", "ADMIN"] }
    },
    select: { id: true, email: true, isActive: true },
  });

  if (!staff) {
    return NextResponse.json(
      { error: "Personel bulunamadı" },
      { status: 404 }
    );
  }

  // ✅ If email is being changed, check for duplicates
  if (input.email && input.email !== staff.email) {
    const duplicate = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });

    if (duplicate) {
      return NextResponse.json(
        { error: "Bu e-posta adresi zaten kullanılıyor" },
        { status: 400 }
      );
    }
  }

  // ✅ SECURITY: Şifre değişiyorsa hash'lenir — düz metin asla veritabanına yazılmaz
  const { password, ...rest } = input;
  const data = password ? { ...rest, password: await bcrypt.hash(password, 12) } : rest;

  // ✅ Update staff with validated data
  const updatedStaff = await prisma.user.update({
    where: { id: params.staffId },
    data,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  // ✅ SECURITY: Hesabı ele geçirmeye ya da erişimi açıp kapamaya yarayan değişiklikler loglanır
  const audit = {
    ...auditRequestContext(request.headers),
    businessId,
    actorUserId: authResult.session.userId,
    actorRole: authResult.session.role,
    entityType: "User",
    entityId: staff.id,
  };
  if (password) {
    createAuditLog({ ...audit, action: AuditActions.USER_PASSWORD_CHANGED });
  }
  if (rest.email && rest.email !== staff.email) {
    createAuditLog({
      ...audit,
      action: AuditActions.USER_EMAIL_CHANGED,
      before: { email: staff.email },
      after: { email: rest.email },
    });
  }
  if (rest.isActive !== undefined && rest.isActive !== staff.isActive) {
    createAuditLog({
      ...audit,
      action: rest.isActive ? AuditActions.USER_REACTIVATED : AuditActions.USER_DEACTIVATED,
    });
  }

  return NextResponse.json({
    message: "Personel güncellendi",
    staff: updatedStaff,
  });
}

// DELETE /api/admin/staff/[staffId] - Garson sil (soft delete)
export const DELETE = withApiHandler("DELETE /api/admin/staff/[staffId]", handleDelete);

async function handleDelete(
  request: NextRequest,
  context: { params: Promise<{ staffId: string }> }
) {
  const params = await context.params;
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

  createAuditLog({
    ...auditRequestContext(request.headers),
    businessId,
    actorUserId: authResult.session.userId,
    actorRole: authResult.session.role,
    action: AuditActions.USER_DELETED,
    entityType: "User",
    entityId: staff.id,
    before: { role: staff.role },
  });

  return NextResponse.json({
    message: "Personel başarıyla silindi",
  });
}
