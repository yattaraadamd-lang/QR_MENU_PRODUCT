import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, getBusinessId } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { error, response, session } = await requireAdmin();
    if (error) return response!;

    const businessId = getBusinessId(session);

    // Tarih filtreleri
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Paralel Sorgular
    const [
      todayPayments,
      monthlyPayments,
      todayOrders,
      totalOrders,
      pendingOrders,
      activeRequests,
      paymentRequests,
      tables,
      recentOrders,
    ] = await Promise.all([
      // Bugünkü Ciro (PAID durumundaki ödemeler)
      prisma.payment.aggregate({
        where: { businessId, status: "PAID", paidAt: { gte: todayStart } },
        _sum: { amount: true },
      }),
      // Aylık Ciro
      prisma.payment.aggregate({
        where: { businessId, status: "PAID", paidAt: { gte: monthStart } },
        _sum: { amount: true },
      }),
      // Bugünkü Sipariş Sayısı
      prisma.order.count({
        where: { businessId, createdAt: { gte: todayStart } },
      }),
      // Toplam Sipariş Sayısı
      prisma.order.count({
        where: { businessId },
      }),
      // Bekleyen Sipariş Sayısı
      prisma.order.count({
        where: { businessId, status: { in: ["PENDING", "ACCEPTED", "PREPARING"] } },
      }),
      // Aktif Talepler (Garson çağırma vs.)
      prisma.serviceRequest.count({
        where: { businessId, status: { in: ["PENDING", "SEEN", "IN_PROGRESS"] }, requestType: { not: "PAYMENT_REQUEST" } },
      }),
      // Ödeme Talepleri
      prisma.serviceRequest.count({
        where: { businessId, status: { in: ["PENDING", "SEEN", "IN_PROGRESS"] }, requestType: "PAYMENT_REQUEST" },
      }),
      // Masalar (Dolu ve Toplam)
      prisma.table.findMany({
        where: { businessId, isDeleted: false },
        select: { status: true },
      }),
      // Son siparişler
      prisma.order.findMany({
        where: { businessId },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          table: { select: { tableNumber: true, tableName: true } },
          items: { select: { id: true } },
        },
      }),
    ]);

    const todayRevenue = todayPayments._sum.amount ? Number(todayPayments._sum.amount) : 0;
    const monthlyRevenue = monthlyPayments._sum.amount ? Number(monthlyPayments._sum.amount) : 0;
    
    const occupiedTableCount = tables.filter((t) => t.status !== "EMPTY").length;
    const totalTableCount = tables.length;

    return NextResponse.json({
      success: true,
      data: {
        todayRevenue,
        monthlyRevenue,
        todayOrderCount: todayOrders,
        totalOrderCount: totalOrders,
        pendingOrderCount: pendingOrders,
        activeRequestCount: activeRequests,
        paymentRequestCount: paymentRequests,
        occupiedTableCount,
        totalTableCount,
        recentOrders,
      },
    });
  } catch (error) {
    console.error("Dashboard özeti alınırken hata:", error);
    return NextResponse.json(
      { success: false, message: "Dashboard verileri yüklenirken bir hata oluştu." },
      { status: 500 }
    );
  }
}
