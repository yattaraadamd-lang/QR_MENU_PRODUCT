import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { success: false, error: "Yetkisiz erişim" },
        { status: 403 }
      );
    }

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
      prisma.user.count({ where: { role: "ADMIN" } }),
      prisma.user.count({ where: { role: "WAITER" } }),
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