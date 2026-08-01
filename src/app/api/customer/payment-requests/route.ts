import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { emitToBusinessRoom } from "@/lib/socket-server";
import { requestPayment } from "@/lib/services/table-flow.service";
import { validateCustomerActionSession } from "@/lib/security/validate-customer-session";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { businessId, tableId, note } = body;

    if (!businessId || !tableId) {
      return NextResponse.json({ error: "Geçersiz talep bilgileri" }, { status: 400 });
    }

    // ✅ GÜVENLIK: CustomerSession doğrulama
    const sessionCheck = await validateCustomerActionSession(request);
    if (!sessionCheck.ok) {
      return NextResponse.json({ error: sessionCheck.error }, { status: sessionCheck.status });
    }

    const customerSession = sessionCheck.customerSession;

    // Validate tableId and businessId match session
    if (customerSession.tableId !== tableId || customerSession.businessId !== businessId) {
      return NextResponse.json(
        { error: "Oturum bu masa veya işletme için geçerli değil." },
        { status: 403 }
      );
    }

    // ✅ GÜVENLIK: Note validasyonu
    if (note && note.length > 500) {
      return NextResponse.json(
        { error: "Not alanı maksimum 500 karakter olabilir." },
        { status: 400 }
      );
    }

    // ✅ RATE LIMIT: 60 saniyede 1 payment request
    const sessionToken = request.headers.get("x-session-token")!;
    const rateLimit = await checkRateLimit(`payment:${sessionToken}`, RATE_LIMITS.PAYMENT_REQUEST);
    if (!rateLimit.allowed) {
      const waitSeconds = Math.ceil((rateLimit.resetAt - Date.now()) / 1000);
      return NextResponse.json(
        { error: `Lütfen ${waitSeconds} saniye bekleyip tekrar deneyin.` },
        { status: 429 }
      );
    }

    const table = customerSession.table;

    // ✅ Payment requests require an active session with orders
    // EMPTY table means no orders exist yet - reject payment request
    if (table.status === "EMPTY") {
      return NextResponse.json(
        { error: "Ödeme talebi göndermek için önce sipariş vermeniz gerekir." },
        { status: 400 }
      );
    }

    // ✅ Merkezi table-flow.service kullanarak transaction ile ödeme talebi oluştur
    const result = await requestPayment(tableId, businessId, note || null);

    // Socket.IO bildirimi (transaction dışında)
    try {
      emitToBusinessRoom(businessId, "payment_request", {
        requestId: result.serviceRequest.id,
        paymentId: result.payment.id,
        tableNumber: result.table.tableNumber,
        tableName: result.table.tableName,
        message: result.message,
        soundType: "payment",
        amount: result.totalAmount,
        createdAt: result.serviceRequest.createdAt,
      });
    } catch { /* socket opsiyonel */ }

    return NextResponse.json({ message: "Ödeme talebi oluşturuldu", payment: result.payment }, { status: 201 });
  } catch (error: any) {
    console.error("Ödeme talebi hatası:", error);

    // ✅ Duplicate ödeme talebi — 409 ile ayrı döndür
    if (error.message && error.message.includes("bekleyen")) {
      return NextResponse.json(
        { error: "Ödeme talebiniz zaten bekliyor.", code: "PAYMENT_REQUEST_ALREADY_EXISTS" },
        { status: 409 }
      );
    }

    // Kullanıcı dostu hata mesajları
    if (error.message && (
      error.message.includes("bulunamadı") ||
      error.message.includes("aktif") ||
      error.message.includes("Boş masadan") ||
      error.message.includes("sipariş")
    )) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Talep oluşturulurken hata oluştu" }, { status: 500 });
  }
}