import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWaiterOrAdmin, getBusinessId } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

/**
 * 🔒 P0-09 FIX: Tables API — Auth + Tenant Isolation
 *
 * PREVIOUSLY: No authentication, businessId from query string.
 * Anyone could list any business's tables.
 *
 * NOW: requireWaiterOrAdmin(), businessId from session.
 */
export async function GET(request: NextRequest) {
  try {
    // ✅ P0-09 FIX: Require authentication
    const { error, response, session } = await requireWaiterOrAdmin();
    if (error) return response!;

    // ✅ P0-09 FIX: businessId from session (NOT from query string)
    const businessId = getBusinessId(session);

    const tables = await prisma.table.findMany({
      where: { businessId },
      orderBy: { tableNumber: "asc" },
      include: {
        orders: {
          where: {
            status: {
              in: ["PENDING", "ACCEPTED", "PREPARING"],
            },
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        serviceRequests: {
          where: {
            status: {
              in: ["PENDING", "IN_PROGRESS"],
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    return NextResponse.json({ tables });
  } catch (error) {
    console.error("Masa listeleme hatası:", error);
    return NextResponse.json(
      { error: "Masalar yüklenirken bir hata oluştu" },
      { status: 500 }
    );
  }
}
