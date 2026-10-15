import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/iyzico";
import { syncIyzicoSubscription } from "@/lib/billing";

export const dynamic = "force-dynamic";

// POST /api/billing/iyzico/webhook — yenileme başarılı/başarısız bildirimleri
// iyzico panelinde bildirim URL'si olarak tanımlanmalı.
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    if (!verifyWebhookSignature(request.headers.get("x-iyz-signature-v3"), payload)) {
      return NextResponse.json({ error: "Geçersiz imza" }, { status: 401 });
    }

    if (payload.subscriptionReferenceCode) {
      // Gövdedeki durum kullanılmaz — iyzico'dan güncel durum okunur
      await syncIyzicoSubscription(payload.subscriptionReferenceCode);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("iyzico webhook hatası:", error);
    // 5xx → iyzico bildirimi tekrar dener
    return NextResponse.json({ error: "İşlenemedi" }, { status: 500 });
  }
}
