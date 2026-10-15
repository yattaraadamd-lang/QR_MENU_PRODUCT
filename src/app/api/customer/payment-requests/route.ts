import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ServiceRequestType, RequestStatus, TableStatus, PaymentStatus } from "@prisma/client";
import { emitToBusinessRoom } from "@/lib/socket-server";

export const dynamic = "force-dynamic";

// POST /api/customer/payment-requests
// ✅ Konum kontrolü tamamen kaldırıldı
// ✅ Güvenlik: CustomerSession (ACTIVE) kontrolü korunuyor
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
      where: { sessionToken, tableId, businessId, status: "ACTIVE" },
    });

    if (!customerSession) {
      return NextResponse.json(
        { error: "Bu masa oturumu kapatılmış veya geçersiz. Lütfen QR kodu tekrar okutun." },
        { status: 401 }
      );
    }

    if (new Date() > customerSession.expiresAt) {
      await prisma.customerSession.update({
        where: { id: customerSession.id },
        data: { status: "EXPIRED" },
      });
      return NextResponse.json({ error: "Oturum süresi doldu." }, { status: 401 });
    }

    const table = await prisma.table.findFirst({
      where: { id: tableId, businessId, isActive: true, isDeleted: false },
      include: { business: true },
    });

    if (!table || !table.business) {
      return NextResponse.json({ error: "Masa bulunamadı veya aktif değil." }, { status: 404 });
    }

    // Bekleyen veya hazırlanmış siparişlerin toplamını bul
    const uncompletedOrders = await prisma.order.findMany({
      where: {
        tableId,
        businessId,
        status: { in: ["ACCEPTED", "PREPARING", "SERVED"] },
      },
    });

    if (uncompletedOrders.length === 0) {
      return NextResponse.json(
        { error: "Ödenecek kabul edilmiş sipariş bulunmamaktadır." },
        { status: 400 }
      );
    }

    const totalAmount = uncompletedOrders.reduce(
      (sum, order) => sum + Number(order.totalPrice),
      0
    );

    // Daha önce bekleyen bir ödeme talebi var mı?
    const existingPayment = await prisma.payment.findFirst({
      where: { tableId, businessId, status: "PENDING" },
    });

    if (existingPayment) {
      return NextResponse.json(
        { error: "Zaten bekleyen bir ödeme talebiniz var." },
        { status: 400 }
      );
    }

    const payment = await prisma.payment.create({
      data: {
        businessId,
        tableId,
        amount: totalAmount,
        status: PaymentStatus.PENDING,
        note: note || null,
      },
    });

    const serviceRequest = await prisma.serviceRequest.create({
      data: {
        businessId,
        tableId,
        requestType: "PAYMENT_REQUEST" as ServiceRequestType,
        note: note || null,
        status: RequestStatus.PENDING,
      },
    });

    // ✅ Masa durumunu güncelle — SADECE masa zaten dolu ise
    if (table.status !== TableStatus.EMPTY) {
      await prisma.table.update({
        where: { id: tableId },
        data: { status: TableStatus.PAYMENT_REQUESTED },
      });
    }

    const title = "Ödeme Talebi";
    const message = `${table.tableName || "Masa " + table.tableNumber} ödeme istiyor (₺${totalAmount.toFixed(2)})`;

    await prisma.notification.create({
      data: {
        businessId,
        tableId,
        type: "PAYMENT_REQUEST",
        title,
        message,
        soundType: "PAYMENT",
      },
    });

    try {
      emitToBusinessRoom(businessId, "payment_request", {
        requestId: serviceRequest.id,
        paymentId: payment.id,
        tableNumber: table.tableNumber,
        tableName: table.tableName,
        message,
        soundType: "payment",
        amount: totalAmount,
        createdAt: serviceRequest.createdAt,
      });
    } catch (e) {
      console.log("Socket emit hatası:", e);
    }

    return NextResponse.json(
      { message: "Ödeme talebi oluşturuldu", payment },
      { status: 201 }
    );
  } catch (error) {
    console.error("Ödeme talebi hatası:", error);
    return NextResponse.json({ error: "Talep oluşturulurken hata oluştu" }, { status: 500 });
  }
}
