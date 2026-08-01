import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, getBusinessId } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

// GET /api/admin/customer-access-blocks — İşletmenin cihaz engellerini listele
export async function GET(request: NextRequest) {
  try {
    const { error, response, session } = await requireAdmin();
    if (error) return response!;

    const businessId = getBusinessId(session);

    const blocks = await prisma.customerAccessBlock.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ blocks });
  } catch (error) {
    console.error("Cihaz engelleri listeleme hatası:", error);
    return NextResponse.json(
      { error: "Cihaz engelleri yüklenirken bir hata oluştu" },
      { status: 500 }
    );
  }
}
