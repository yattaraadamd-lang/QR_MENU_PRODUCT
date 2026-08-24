import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/tenant";
import { createAuditLog, AuditActions } from "@/lib/services/audit-log.service";

// PATCH /api/admin/customer-access-blocks/[id]/revoke — Cihaz engelini kaldır
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const authResult = await requireAdmin();
    if (!authResult.success) return authResult.response;

    const { businessId, userId, name: adminName } = authResult.session;

    // Body'den opsiyonel açıklama al
    let note: string | null = null;
    try {
      const body = await request.json();
      if (body.note && typeof body.note === "string") {
        // Maksimum 500 karakter
        note = body.note.trim().slice(0, 500) || null;
      }
    } catch {
      // Body olmayabilir — sorun değil
    }

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
  } catch (error) {
    console.error("Cihaz engeli kaldırma hatası:", error);
    return NextResponse.json(
      { error: "Cihaz engeli kaldırılırken bir hata oluştu" },
      { status: 500 }
    );
  }
}
