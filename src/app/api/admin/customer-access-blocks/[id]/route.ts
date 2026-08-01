import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, getBusinessId } from "@/lib/auth-helpers";

// DELETE /api/admin/customer-access-blocks/[id] — Cihaz engelini kaldır
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { error, response, session } = await requireAdmin();
    if (error) return response!;

    const businessId = getBusinessId(session);

    const block = await prisma.customerAccessBlock.findFirst({
      where: { id: params.id, businessId },
    });

    if (!block) {
      return NextResponse.json({ error: "Engelleme kaydı bulunamadı" }, { status: 404 });
    }

    await prisma.customerAccessBlock.update({
      where: { id: params.id },
      data: { revokedAt: new Date() },
    });

    return NextResponse.json({
      message: "Cihaz engeli kaldırıldı.",
      code: "CUSTOMER_DEVICE_UNBLOCKED",
    });
  } catch (error) {
    console.error("Cihaz engeli kaldırma hatası:", error);
    return NextResponse.json(
      { error: "Cihaz engeli kaldırılırken bir hata oluştu" },
      { status: 500 }
    );
  }
}
