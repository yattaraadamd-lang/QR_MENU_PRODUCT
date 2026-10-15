import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, getBusinessIdFromSession } from "@/lib/tenant";
import { getUsageSummary } from "@/lib/subscription";

export const dynamic = "force-dynamic";

// GET /api/admin/subscription — Mevcut plan, deneme durumu, kullanım ve yükseltilebilir planlar
export async function GET() {
  try {
    const authResult = await requireAdmin();
    if (!authResult.success) return authResult.response;

    const businessId = getBusinessIdFromSession(authResult.session);

    const [summary, plans] = await Promise.all([
      getUsageSummary(businessId),
      prisma.subscriptionPlan.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { monthlyPrice: "asc" }],
      }),
    ]);

    return NextResponse.json({
      ...summary,
      plans: plans.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        description: p.description,
        monthlyPrice: Number(p.monthlyPrice),
        maxTables: p.maxTables,
        maxWaiters: p.maxWaiters,
        maxProducts: p.maxProducts,
        hasReports: p.hasReports,
        hasPayments: p.hasPayments,
        canPurchase: !!p.iyzicoPricingPlanRef,
      })),
    });
  } catch (error) {
    console.error("Abonelik bilgisi hatası:", error);
    return NextResponse.json({ error: "Abonelik bilgisi alınamadı" }, { status: 500 });
  }
}
