import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWaiterOrAdmin, getBusinessId } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

/**
 * GET /api/badge-counts
 * Admin ve garson layout'larında nav badge sayılarını döner.
 * Kimlik doğrulaması gerektirir (waiter veya admin).
 */
export async function GET() {
  try {
    const { error, response, session } = await requireWaiterOrAdmin();
    if (error) return response!;
    const businessId = getBusinessId(session);

    const [pendingOrders, activeRequests, pendingPayments] = await Promise.all([
      // Bekleyen siparişler (garson henüz kabul etmedi)
      prisma.order.count({
        where: {
          businessId,
          status: "PENDING",
        },
      }),
      // Aktif hizmet talepleri (garson çağırma, yardım vs.)
      prisma.serviceRequest.count({
        where: {
          businessId,
          status: { in: ["PENDING", "SEEN", "IN_PROGRESS"] },
        },
      }),
      // Bekleyen ödeme talepleri
      prisma.payment.count({
        where: {
          businessId,
          status: "PENDING",
        },
      }),
    ]);

    return NextResponse.json({
      orders: pendingOrders,
      requests: activeRequests,
      payments: pendingPayments,
      total: pendingOrders + activeRequests + pendingPayments,
    });
  } catch (e) {
    console.error("Badge counts error:", e);
    return NextResponse.json({ orders: 0, requests: 0, payments: 0, total: 0 });
  }
}
