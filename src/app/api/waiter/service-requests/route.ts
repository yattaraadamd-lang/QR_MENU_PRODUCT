import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWaiterOrAdmin, getBusinessId } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

// GET /api/waiter/service-requests - Garson hizmet talepleri
export async function GET(request: NextRequest) {
  try {
    const { error, response, session } = await requireWaiterOrAdmin();
    if (error) return response!;

    const businessId = getBusinessId(session);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const where: any = { businessId };
    if (status === "active") {
      where.status = { in: ["PENDING", "SEEN", "IN_PROGRESS"] };
    } else if (status === "completed") {
      where.status = { in: ["COMPLETED", "CANCELLED"] };
    }

    const serviceRequests = await prisma.serviceRequest.findMany({
      where,
      include: { table: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ serviceRequests });
  } catch (error) {
    console.error("Hizmet talebi listeleme hatası:", error);
    return NextResponse.json(
      { error: "Talepler yüklenirken bir hata oluştu" },
      { status: 500 }
    );
  }
}
