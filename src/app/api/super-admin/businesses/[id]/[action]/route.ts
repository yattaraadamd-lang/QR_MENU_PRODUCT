import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { createAuditLog, auditRequestContext, AuditActions } from "@/lib/services/audit-log.service";
import { withApiHandler } from "@/lib/api/handler";

export const PATCH = withApiHandler("PATCH /api/super-admin/businesses/[id]/[action]", handlePatch);

async function handlePatch(
  request: NextRequest,
  context: { params: Promise<{ id: string; action: string }> }
) {
  const params = await context.params;
  const { error, response, session } = await requireSuperAdmin();
  if (error) return response;

  const { id, action } = params;

  if (action !== "activate" && action !== "deactivate") {
    return NextResponse.json({ error: "Geçersiz işlem" }, { status: 400 });
  }

  // Olmayan id'de update P2025 ile 500 veriyordu
  const existing = await prisma.business.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return NextResponse.json({ error: "İşletme bulunamadı" }, { status: 404 });
  }

  const business = await prisma.business.update({
    where: { id },
    data: { isActive: action === "activate" },
  });

  // ✅ SECURITY: İşletmeyi askıya almak tüm personelinin erişimini keser; kim yaptı izlenebilmeli
  createAuditLog({
    ...auditRequestContext(request.headers),
    businessId: business.id,
    actorUserId: session.user.id,
    actorRole: "SUPER_ADMIN",
    action: action === "activate" ? AuditActions.BUSINESS_ACTIVATED : AuditActions.BUSINESS_DEACTIVATED,
    entityType: "Business",
    entityId: business.id,
  });

  return NextResponse.json({ success: true, business });
}
