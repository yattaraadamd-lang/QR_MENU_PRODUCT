import { NextRequest, NextResponse } from "next/server";
import { retrieveSubscriptionCheckout, verifyCallbackState } from "@/lib/iyzico";
import { activateIyzicoSubscription } from "@/lib/billing";

export const dynamic = "force-dynamic";

// POST /api/billing/iyzico/callback — iyzico ödeme formu tamamlanınca tarayıcıyı buraya POST eder
// Form gövdesindeki token'a güvenilmez; sonuç iyzico API'sinden tekrar okunur.
export async function POST(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
  const redirect = (status: "success" | "failed") =>
    NextResponse.redirect(`${appUrl}/admin/subscription?payment=${status}`, 303);

  try {
    const state = verifyCallbackState(request.nextUrl.searchParams.get("state"));
    const form = await request.formData();
    const token = form.get("token");

    if (!state || typeof token !== "string" || !token) return redirect("failed");

    const iyziSubscription = await retrieveSubscriptionCheckout(token);
    if (iyziSubscription.subscriptionStatus !== "ACTIVE") return redirect("failed");

    await activateIyzicoSubscription(state.businessId, state.planId, iyziSubscription);
    return redirect("success");
  } catch (error) {
    console.error("iyzico callback hatası:", error);
    return redirect("failed");
  }
}
