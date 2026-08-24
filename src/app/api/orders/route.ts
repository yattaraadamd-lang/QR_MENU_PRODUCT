import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWaiterOrAdmin, getBusinessId } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

/**
 * 🔒 P0-09 FIX: Orders List API — Auth + Tenant Isolation
 *
 * POST: Disabled (use /api/customer/orders)
 * GET: requireWaiterOrAdmin(), businessId from session
 *
 * PREVIOUSLY: Used raw getServerSession without DB-level active user check.
 * NOW: Uses requireWaiterOrAdmin() which verifies user is active and not deleted.
 */
export async function POST() {
  return NextResponse.json(
    { error: "Bu endpoint kullanımdan kaldırılmıştır. Lütfen /api/customer/orders kullanın." },
    { status: 410 }
  );
}

export async function GET(request: NextRequest) {
  try {
    // ✅ P0-09 FIX: Use centralized auth guard with DB-level user validation
    const { error, response, session } = await requireWaiterOrAdmin();
    if (error) return response!;

    // ✅ P0-09 FIX: businessId from session (NOT from query string)
    const businessId = getBusinessId(session);

    const orders = await prisma.order.findMany({
      where: { businessId },
      select: {
        id: true,
        totalPrice: true,
        status: true,
        paymentStatus: true,
        note: true,
        createdAt: true,
        table: {
          select: {
            id: true,
            tableNumber: true,
            tableName: true,
          },
        },
        waiter: {
          select: {
            id: true,
            name: true,
          },
        },
        items: {
          select: {
            id: true,
            productName: true,
            quantity: true,
            unitPrice: true,
            totalPrice: true,
            customerNote: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ orders });
  } catch (error) {
    console.error("[ORDER_LIST_ERROR]", error);
    return NextResponse.json(
      { error: "Siparişler yüklenirken bir hata oluştu" },
      { status: 500 }
    );
  }
}
