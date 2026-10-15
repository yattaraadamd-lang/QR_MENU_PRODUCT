import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, getBusinessIdFromSession } from "@/lib/tenant";
import { cancelSubscription, IyzicoError } from "@/lib/iyzico";
import { syncIyzicoSubscription } from "@/lib/billing";

export const dynamic = "force-dynamic";

// POST /api/admin/billing/cancel — ücretli aboneliği iyzico'da iptal eder
export async function POST() {
  try {
    const authResult = await requireAdmin();
    if (!authResult.success) return authResult.response;

    const businessId = getBusinessIdFromSession(authResult.session);
    const subscription = await prisma.businessSubscription.findFirst({
      where: { businessId, status: { in: ["ACTIVE", "PAST_DUE"] }, iyzicoSubscriptionRef: { not: null } },
    });

    if (!subscription?.iyzicoSubscriptionRef) {
      return NextResponse.json({ error: "İptal edilecek ücretli abonelik yok" }, { status: 404 });
    }

    await cancelSubscription(subscription.iyzicoSubscriptionRef);
    await syncIyzicoSubscription(subscription.iyzicoSubscriptionRef);

    return NextResponse.json({ success: true, message: "Aboneliğiniz iptal edildi" });
  } catch (error) {
    if (error instanceof IyzicoError) {
      return NextResponse.json({ error: `İptal edilemedi: ${error.message}` }, { status: 502 });
    }
    console.error("Abonelik iptal hatası:", error);
    return NextResponse.json({ error: "Abonelik iptal edilemedi" }, { status: 500 });
  }
}
