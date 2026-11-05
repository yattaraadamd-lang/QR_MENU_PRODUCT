import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, getBusinessId } from "@/lib/auth-helpers";
import { withApiHandler } from "@/lib/api/handler";
import { AuditActions, createAuditLog } from "@/lib/services/audit-log.service";
import { renderTableQr, rotateTableQr } from "@/lib/services/table-qr.service";

// POST /api/admin/tables/[id]/rotate-qr - Eski QR'ı geçersiz kılıp yenisini üretir
export const POST = withApiHandler("POST /api/admin/tables/[id]/rotate-qr", handlePost);

async function handlePost(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;

  const { error, response, session } = await requireAdmin();
  if (error) return response!;
  const businessId = getBusinessId(session);

  const existing = await prisma.table.findFirst({
    where: { id: params.id, businessId, isDeleted: false },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Masa bulunamadı" }, { status: 404 });
  }

  const { table, qrToken, closedSessions, cancelledRequests } = await rotateTableQr(params.id, businessId);

  createAuditLog({
    businessId,
    actorUserId: session.user.id,
    actorRole: "ADMIN",
    action: AuditActions.QR_ROTATED,
    entityType: "Table",
    entityId: table.id,
    metadata: { closedSessions, cancelledRequests },
  });

  return NextResponse.json({
    message: "QR kod yenilendi",
    tableId: table.id,
    tableNumber: table.tableNumber,
    tableName: table.tableName,
    ...(await renderTableQr(qrToken)),
  });
}
