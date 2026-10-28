import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWaiterOrAdmin, getBusinessId } from "@/lib/auth-helpers";
import { withApiHandler } from "@/lib/api/handler";

export const dynamic = "force-dynamic";

/**
 * GET /api/badge-counts
 * Admin ve garson layout'larında nav badge sayılarını döner.
 * Kimlik doğrulaması gerektirir (waiter veya admin).
 *
 * Hata 500 döner (eskiden 200 + sıfırlar dönüyordu): useBadgeCounts yalnız başarılı yanıtta
 * günceller, böylece DB kesintisinde bekleyen siparişler sıfır görünmez, son bilinen sayı kalır.
 */
export const GET = withApiHandler("GET /api/badge-counts", handleGet);

async function handleGet() {
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
    // Aktif hizmet talepleri — PAYMENT_REQUEST hariç (Ödemeler sekmesinde gösterilir)
    prisma.serviceRequest.count({
      where: {
        businessId,
        status: { in: ["PENDING", "SEEN", "IN_PROGRESS"] },
        requestType: { not: "PAYMENT_REQUEST" },
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
}
