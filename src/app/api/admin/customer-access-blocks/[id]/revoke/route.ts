import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/tenant";
import { createAuditLog, AuditActions } from "@/lib/services/audit-log.service";
import { withApiHandler, parseJson } from "@/lib/api/handler";
import { accessBlockRevokeSchema } from "@/lib/validation";

// PATCH /api/admin/customer-access-blocks/[id]/revoke — Cihaz engelini kaldır
export const PATCH = withApiHandler("PATCH /api/admin/customer-access-blocks/[id]/revoke", handlePatch);

async function handlePatch(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const authResult = await requireAdmin();
  if (!authResult.success) return authResult.response;

  const { businessId, userId, name: adminName } = authResult.session;

  // Body'den opsiyonel açıklama al
  // Body olmayabilir — sorun değil; varsa not en fazla 500 karakter saklanır
  const body = await parseJson(request, accessBlockRevokeSchema, { optional: true });
  const note = body.note?.trim().slice(0, 500) || null;

  // Kaydı bul — mutlaka aynı işletmeye ait olmalı
  const block = await prisma.customerAccessBlock.findFirst({
    where: { id: params.id, businessId },
  });

  if (!block) {
    return NextResponse.json(
      { error: "Engelleme kaydı bulunamadı veya bu işletmeye ait değil." },
      { status: 404 }
    );
  }

  // Zaten kaldırılmışsa — idempotent dönüş
  if (block.revokedAt) {
    return NextResponse.json({
      message: "Bu engel zaten kaldırılmış.",
      block: {
        id: block.id,
        revokedAt: block.revokedAt,
        revokedById: block.revokedById,
        revocationNote: block.revocationNote,
        status: "revoked",
      },
    });
  }

  // Engeli kaldır — atomik update
  const updatedBlock = await prisma.customerAccessBlock.update({
    where: { id: block.id },
    data: {
      revokedAt: new Date(),
      revokedById: userId,
      revocationNote: note,
    },
  });

  // NOT: Eski REVOKED müşteri oturumu aktif edilmez.
  // Kullanıcı QR'ı yeniden okuttuğunda yeni VIEW_ONLY oturum alır.

  createAuditLog({
    businessId,
    actorUserId: userId,
    actorRole: "ADMIN",
    action: AuditActions.DEVICE_UNBLOCKED,
    entityType: "CustomerAccessBlock",
    entityId: updatedBlock.id,
    metadata: {
      note,
    },
  });

  return NextResponse.json({
    message: "Cihaz engeli başarıyla kaldırıldı.",
    code: "CUSTOMER_DEVICE_UNBLOCKED",
    block: {
      id: updatedBlock.id,
      revokedAt: updatedBlock.revokedAt,
      revokedById: updatedBlock.revokedById,
      revocationNote: updatedBlock.revocationNote,
      status: "revoked",
    },
  });
}
