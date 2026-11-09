import { NextRequest, NextResponse } from "next/server";
import type { AdminOrderListResponse } from "@/contracts/orders";
import { prisma } from "@/lib/prisma";
import { requireWaiterOrAdmin, getBusinessId } from "@/lib/auth-helpers";
import { withApiHandler } from "@/lib/api/handler";
import { ADMIN_ORDER_LIST_SELECT, toAdminOrderDTO } from "@/lib/api/orders.dto";

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

export const GET = withApiHandler("GET /api/orders", handleGet);

async function handleGet(request: NextRequest) {
  // ✅ P0-09 FIX: Use centralized auth guard with DB-level user validation
  const { error, response, session } = await requireWaiterOrAdmin();
  if (error) return response!;

  // ✅ P0-09 FIX: businessId from session (NOT from query string)
  const businessId = getBusinessId(session);

  const orders = await prisma.order.findMany({
    where: { businessId },
    select: ADMIN_ORDER_LIST_SELECT,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ orders: orders.map(toAdminOrderDTO) } satisfies AdminOrderListResponse);
}
