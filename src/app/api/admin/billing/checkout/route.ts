import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, getBusinessIdFromSession } from "@/lib/tenant";
import {
  initializeSubscriptionCheckout,
  isIyzicoConfigured,
  signCallbackState,
  IyzicoError,
} from "@/lib/iyzico";
import { withApiHandler, ApiError, parseJson } from "@/lib/api/handler";

export const dynamic = "force-dynamic";

const checkoutSchema = z.object({
  planCode: z.string().min(1),
  customer: z.object({
    name: z.string().trim().min(2).max(50),
    surname: z.string().trim().min(2).max(50),
    gsmNumber: z.string().trim().regex(/^\+?\d{10,13}$/, "Telefon numarası geçersiz (örn. +905551234567)"),
    identityNumber: z.string().trim().regex(/^\d{11}$/, "T.C. kimlik / vergi numarası 11 haneli olmalı"),
    city: z.string().trim().min(2).max(50),
    address: z.string().trim().min(5).max(200),
  }),
});

// POST /api/admin/billing/checkout — iyzico abonelik ödeme formunu başlatır
export const POST = withApiHandler("POST /api/admin/billing/checkout", handlePost);

async function handlePost(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (!authResult.success) return authResult.response;

    if (!isIyzicoConfigured()) {
      return NextResponse.json({ error: "Online ödeme henüz aktif değil." }, { status: 503 });
    }

    const businessId = getBusinessIdFromSession(authResult.session);
    const { planCode, customer } = await parseJson(request, checkoutSchema);

    const plan = await prisma.subscriptionPlan.findFirst({
      where: { code: planCode, isActive: true },
    });
    if (!plan?.iyzicoPricingPlanRef) {
      return NextResponse.json({ error: "Bu plan için online ödeme tanımlı değil." }, { status: 400 });
    }

    // Plan değişikliği iyzico tarafında ayrı akış — şimdilik önce iptal gerekir
    const activePaid = await prisma.businessSubscription.findFirst({
      where: { businessId, status: { in: ["ACTIVE", "PAST_DUE"] }, iyzicoSubscriptionRef: { not: null } },
    });
    if (activePaid) {
      return NextResponse.json(
        { error: "Zaten ücretli bir aboneliğiniz var. Plan değiştirmek için önce mevcut aboneliği iptal edin." },
        { status: 409 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const state = signCallbackState(businessId, plan.id);
    const callbackUrl = `${appUrl}/api/billing/iyzico/callback?state=${encodeURIComponent(state)}`;

    const result = await initializeSubscriptionCheckout({
      pricingPlanReferenceCode: plan.iyzicoPricingPlanRef,
      callbackUrl,
      conversationId: businessId,
      customer: { ...customer, email: authResult.session.email },
    });

    return NextResponse.json({ checkoutFormContent: result.checkoutFormContent, token: result.token });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof IyzicoError) {
      console.error("iyzico checkout hatası:", error.errorCode, error.message);
      return NextResponse.json({ error: `Ödeme başlatılamadı: ${error.message}` }, { status: 502 });
    }
    console.error("Checkout hatası:", error);
    return NextResponse.json({ error: "Ödeme başlatılamadı" }, { status: 500 });
  }
}
