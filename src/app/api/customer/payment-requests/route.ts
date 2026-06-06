import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { emitToBusinessRoom } from "@/lib/socket-server";
import { requestPayment } from "@/lib/services/table-flow.service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { businessId, tableId, note } = body;

    if (!businessId || !tableId) {
      return NextResponse.json({ error: "Geçersiz talep bilgileri" }, { status: 400 });
    }

    // ✅ Session token kontrolü — CustomerSession tablosundan doğrula
    const sessionToken = request.headers.get("x-session-token");
    if (!sessionToken) {
      return NextResponse.json({ error: "Oturum token'ı gerekli." }, { status: 401 });
    }

    const customerSession = await prisma.customerSession.findFirst({
      where: {
        sessionToken,
        tableId,
        businessId,
        status: "ACTIVE",
      },
    });

    if (!customerSession) {
      return NextResponse.json({ error: "Geçersiz oturum veya masa bulunamadı." }, { status: 401 });
    }

    if (new Date() > customerSession.expiresAt) {
      await prisma.customerSession.update({
        where: { id: customerSession.id },
        data: { status: "EXPIRED" },
      });
      return NextResponse.json({ error: "Oturum süresi doldu." }, { status: 401 });
    }

    // ✅ Merkezi table-flow.service kullanarak transaction ile ödeme talebi oluştur
    // Payment + ServiceRequest + Notification + Table.status hepsi atomik
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

    // Kullanıcı dostu hata mesajları
    if (error.message && (
      error.message.includes("bulunamadı") ||
      error.message.includes("aktif") ||
      error.message.includes("Boş masadan") ||
      error.message.includes("sipariş") ||
      error.message.includes("bekleyen")
    )) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Talep oluşturulurken hata oluştu" }, { status: 500 });
  }
}
