import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ServiceRequestType, RequestStatus, TableStatus } from "@prisma/client";
import { emitToBusinessRoom } from "@/lib/socket-server";

export const dynamic = "force-dynamic";

// Spam engelleme: aynı masa + aynı tip için cooldown (saniye)
const COOLDOWN_SECONDS: Record<string, number> = {
  CALL_WAITER: 60,
  PAYMENT_REQUEST: 120,
  HELP_REQUEST: 60,
  CLEANING_REQUEST: 120,
  ORDER_REQUEST: 30,
  PRODUCT_INFO: 30,
  COMPLAINT_SUGGESTION: 60,
};

// POST /api/customer/service-requests
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { businessId, tableId, requestType, note, reason } = body;

    if (!businessId || !tableId || !requestType) {
      return NextResponse.json({ error: "Geçersiz talep bilgileri" }, { status: 400 });
    }

    // ✅ Session token kontrolü — CustomerSession tablosundan doğrula
    const sessionToken = request.headers.get("x-session-token");
    if (!sessionToken) {
      return NextResponse.json(
        { error: "Oturum token'ı gerekli. Lütfen QR kodu tekrar okutun." },
        { status: 401 }
      );
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
      return NextResponse.json(
        { error: "Bu QR kod artık geçerli değil. Lütfen işletme personelinden yeni QR kod isteyin." },
        { status: 401 }
      );
    }

    if (new Date() > customerSession.expiresAt) {
      await prisma.customerSession.update({
        where: { id: customerSession.id },
        data: { status: "EXPIRED" },
      });
      return NextResponse.json(
        { error: "Oturum süresi doldu. Lütfen QR kodu tekrar okutun." },
        { status: 401 }
      );
    }

    // ✅ Masa kontrolü — silinen masa engellenir
    const table = await prisma.table.findFirst({
      where: {
        id: tableId,
        businessId,
        isActive: true,
        isDeleted: false,
      },
      include: { business: true },
    });

    if (!table || !table.business) {
      return NextResponse.json(
        { error: "Masa bulunamadı veya aktif değil." },
        { status: 404 }
      );
    }

    const business = table.business;

    // İşletme aktif mi?
    if (!business.isActive) {
      return NextResponse.json({ error: "İşletme şu anda hizmet vermiyor." }, { status: 403 });
    }

    // ✅ Spam engelleme: aktif talep var mı?
    const existingActive = await prisma.serviceRequest.findFirst({
      where: {
        tableId,
        businessId,
        requestType: requestType as ServiceRequestType,
        status: { in: [RequestStatus.PENDING, RequestStatus.SEEN, RequestStatus.IN_PROGRESS] },
      },
    });

    if (existingActive) {
      return NextResponse.json(
        { error: "Talebiniz zaten personele iletildi. Lütfen kısa bir süre bekleyin." },
        { status: 409 }
      );
    }

    // ✅ Cooldown kontrolü: son X saniye içinde aynı tip talep gönderilmiş mi?
    const cooldownSec = COOLDOWN_SECONDS[requestType] || 60;
    const cooldownTime = new Date(Date.now() - cooldownSec * 1000);

    const recentRequest = await prisma.serviceRequest.findFirst({
      where: {
        tableId,
        businessId,
        requestType: requestType as ServiceRequestType,
        createdAt: { gte: cooldownTime },
      },
      orderBy: { createdAt: "desc" },
    });

    if (recentRequest) {
      const secondsAgo = Math.floor((Date.now() - recentRequest.createdAt.getTime()) / 1000);
      const remaining = cooldownSec - secondsAgo;
      return NextResponse.json(
        { error: `Talebiniz zaten iletildi. Lütfen ${remaining} saniye bekleyin.` },
        { status: 429 }
      );
    }

    // Not alanını birleştir: reason + note
    const combinedNote = [reason, note].filter(Boolean).join(" — ") || null;

    // Hizmet talebi oluştur
    const serviceRequest = await prisma.serviceRequest.create({
      data: {
        businessId,
        tableId,
        requestType: requestType as ServiceRequestType,
        note: combinedNote,
        status: RequestStatus.PENDING,
      },
      include: { table: true },
    });

    // ✅ Masa durumunu güncelle — SADECE masa zaten dolu ise
    // Masa EMPTY iken garson çağırma/ödeme isteği masayı dolu YAPMAZ
    let tableStatus = table.status;
    if (table.status !== TableStatus.EMPTY) {
      if (requestType === "CALL_WAITER") {
        tableStatus = TableStatus.WAITING_WAITER;
      } else if (requestType === "PAYMENT_REQUEST") {
        tableStatus = TableStatus.PAYMENT_REQUESTED;
      }
    }

    if (tableStatus !== table.status) {
      await prisma.table.update({
        where: { id: tableId },
        data: { status: tableStatus },
      });
    }

    // Bildirim türü ve ses belirle
    let notificationType: any = "SERVICE_REQUEST";
    let soundType: any = "DEFAULT";
    let title = "Hizmet Talebi";
    let message = `${table.tableName || "Masa " + table.tableNumber} hizmet talep etti`;
    let socketEvent = "service_request";

    if (requestType === "CALL_WAITER") {
      notificationType = "CALL_WAITER";
      soundType = "WAITER_CALL";
      title = "Garson Çağrısı";
      message = `${table.tableName || "Masa " + table.tableNumber} garson çağırdı`;
      if (reason) message += ` — ${reason}`;
      socketEvent = "call_waiter";
    } else if (requestType === "PAYMENT_REQUEST") {
      notificationType = "PAYMENT_REQUEST";
      soundType = "PAYMENT";
      title = "Ödeme Talebi";
      message = `${table.tableName || "Masa " + table.tableNumber} ödeme istiyor`;
      socketEvent = "payment_request";
    } else if (requestType === "HELP_REQUEST") {
      notificationType = "SERVICE_REQUEST";
      soundType = "URGENT";
      title = "Yardım Talebi";
      message = `${table.tableName || "Masa " + table.tableNumber} yardım istiyor`;
      socketEvent = "help_request";
    } else if (requestType === "CLEANING_REQUEST") {
      title = "Temizlik Talebi";
      message = `${table.tableName || "Masa " + table.tableNumber} temizlik istiyor`;
    }

    // Bildirim oluştur
    await prisma.notification.create({
      data: {
        businessId,
        tableId,
        type: notificationType,
        title,
        message,
        soundType,
      },
    });

    // Socket.IO bildirimi
    try {
      emitToBusinessRoom(businessId, socketEvent, {
        requestId: serviceRequest.id,
        tableNumber: table.tableNumber,
        tableName: table.tableName,
        message,
        soundType: soundType.toLowerCase(),
        requestType,
        reason: reason || null,
        note: note || null,
        createdAt: serviceRequest.createdAt,
      });
    } catch (e) {
      console.log("Socket emit hatası:", e);
    }

    return NextResponse.json(
      { message: "Talep başarıyla oluşturuldu", serviceRequest },
      { status: 201 }
    );
  } catch (error) {
    console.error("Hizmet talebi oluşturma hatası:", error);
    return NextResponse.json({ error: "Talep oluşturulurken bir hata oluştu" }, { status: 500 });
  }
}

