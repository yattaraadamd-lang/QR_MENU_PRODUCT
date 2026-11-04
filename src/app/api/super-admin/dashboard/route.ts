import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { error, response } = await requireSuperAdmin();
    if (error) return response;

    const [
      totalBusinesses,
      activeBusinesses,
      totalAdmins,
      totalWaiters,
      totalOrders,
      subscriptions,
    ] = await Promise.all([
      prisma.business.count(),
      prisma.business.count({ where: { isActive: true } }),
      // Silinmiş personel sayılmaz (kota sayımı da böyle: subscription-guard)
      prisma.user.count({ where: { role: "ADMIN", deletedAt: null } }),
      prisma.user.count({ where: { role: "WAITER", deletedAt: null } }),
      prisma.order.count(),
      prisma.businessSubscription.findMany({
        where: { status: "ACTIVE" },
        include: { plan: true },
      }),
    ]);

    const monthlyPlatformRevenue = subscriptions.reduce((sum, sub) => {
      return sum + Number(sub.plan.monthlyPrice);
    }, 0);

    const stats = {
      totalBusinesses,
      activeBusinesses,
      totalAdmins,
      totalWaiters,
      monthlyPlatformRevenue,
      totalOrders,
      totalPayments: 0,
    };

    return NextResponse.json({ success: true, stats });
  } catch (error) {
    console.error("Super Admin dashboard data error:", error);

    return NextResponse.json(
      { success: false, error: "Sunucu hatası" },
      { status: 500 }
    );
  }
}