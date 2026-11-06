import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, getBusinessIdFromSession } from "@/lib/tenant";
import { IyzicoError } from "@/lib/iyzico";
import { cancelPaidSubscription } from "@/lib/billing";
import { withApiHandler, ApiError } from "@/lib/api/handler";

export const dynamic = "force-dynamic";

// POST /api/admin/billing/cancel — ücretli aboneliği iyzico'da iptal eder
export const POST = withApiHandler("POST /api/admin/billing/cancel", handlePost);

async function handlePost() {
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

    const cancelled = await cancelPaidSubscription(subscription);
    const until =
      cancelled.endsAt && cancelled.endsAt > new Date()
        ? cancelled.endsAt.toLocaleDateString("tr-TR", { dateStyle: "long", timeZone: "Europe/Istanbul" })
        : null;

    return NextResponse.json({
      success: true,
      message: until ? `Aboneliğiniz iptal edildi. Planınız ${until} tarihine kadar sürer.` : "Aboneliğiniz iptal edildi",
      endsAt: cancelled.endsAt,
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof IyzicoError) {
      return NextResponse.json({ error: `İptal edilemedi: ${error.message}` }, { status: 502 });
    }
    console.error("Abonelik iptal hatası:", error);
    return NextResponse.json({ error: "Abonelik iptal edilemedi" }, { status: 500 });
  }
}
