import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/tenant";
import { withApiHandler } from "@/lib/api/handler";

// DELETE /api/admin/customer-access-blocks/[id] — Cihaz engelini kaldır (geriye uyumluluk)
// Aynı mantık revoke endpoint'iyle paylaşılır — iş mantığı kopyalanmaz.
export const DELETE = withApiHandler("DELETE /api/admin/customer-access-blocks/[id]", handleDelete);

async function handleDelete(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const authResult = await requireAdmin();
  if (!authResult.success) return authResult.response;

  const { businessId, userId } = authResult.session;

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
      code: "CUSTOMER_DEVICE_UNBLOCKED",
    });
  }

  // Engeli kaldır — revokedAt doldur, kayıt silinmez
  await prisma.customerAccessBlock.update({
    where: { id: block.id },
    data: {
      revokedAt: new Date(),
      revokedById: userId,
      revocationNote: "DELETE endpoint üzerinden kaldırıldı",
    },
  });

  return NextResponse.json({
    message: "Cihaz engeli kaldırıldı.",
    code: "CUSTOMER_DEVICE_UNBLOCKED",
  });
}
