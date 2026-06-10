import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ServiceRequestType, RequestStatus, TableStatus } from "@prisma/client";
import { emitToBusinessRoom } from "@/lib/socket-server";
import { validateCustomerActionSession } from "@/lib/security/validate-customer-session";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

// POST /api/customer/service-requests
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { businessId, tableId, requestType, note, reason } = body;

    if (!businessId || !tableId || !requestType) {
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

    // ✅ GÜVENLIK: Note ve reason validasyonu
    if (note && note.length > 500) {
      return NextResponse.json(
        { error: "Not alanı maksimum 500 karakter olabilir." },
        { status: 400 }
      );
    }
    if (reason && reason.length > 200) {
      return NextResponse.json(
        { error: "Sebep alanı maksimum 200 karakter olabilir." },
        { status: 400 }
      );
    }

    // ✅ GÜVENLIK: RequestType validasyonu
    const validRequestTypes = [
      "CALL_WAITER",
      "PAYMENT_REQUEST",
      "HELP_REQUEST",
      "CLEANING_REQUEST",
      "ORDER_REQUEST",
      "PRODUCT_INFO",
      "COMPLAINT_SUGGESTION",
    ];
    if (!validRequestTypes.includes(requestType)) {
      return NextResponse.json(
        { error: "Geçersiz talep türü." },
        { status: 400 }
      );
    }

    // ✅ RATE LIMIT: 60 saniyede 1 service request
    const sessionToken = request.headers.get("x-session-token")!;
    const rateLimit = await checkRateLimit(`service:${sessionToken}`, RATE_LIMITS.SERVICE_REQUEST);
    if (!rateLimit.allowed) {
      const waitSeconds = Math.ceil((rateLimit.resetAt - Date.now()) / 1000);
      return NextResponse.json(
        { error: `Lütfen ${waitSeconds} saniye bekleyip tekrar deneyin.` },
        { status: 429 }
      );
    }

    const table = customerSession.table;
    const business = customerSession.business;

    // İşletme aktif mi?
    if (!business.isActive) {
      return NextResponse.json({ error: "İşletme şu anda hizmet vermiyor." }, { status: 403 });
    }

    // ✅ SPAM KORUMASI: Aynı masa için PENDING durumunda talep var mı kontrol et
    // ServiceRequestType'a göre kontrol - her tip için ayrı ayrı
    const existingPendingRequest = await prisma.serviceRequest.findFirst({
      where: {
        tableId,
        businessId,
        requestType: requestType as ServiceRequestType,
        status: "PENDING",
      },
      orderBy: { createdAt: "desc" },
    });

    if (existingPendingRequest) {
      const messageMap: Record<string, string> = {
        CALL_WAITER: "Bu masa için zaten bekleyen bir garson çağrısı var. Garson en kısa sürede gelecektir.",
        PAYMENT_REQUEST: "Bu masa için zaten bekleyen bir ödeme talebi var. Garson en kısa sürede gelecektir.",
        HELP_REQUEST: "Bu masa için zaten bekleyen bir yardım talebi var. Personel en kısa sürede ilgilenecektir.",
        CLEANING_REQUEST: "Bu masa için zaten bekleyen bir temizlik talebi var.",
        ORDER_REQUEST: "Bu masa için zaten bekleyen bir sipariş talebi var.",
        PRODUCT_INFO: "Bu masa için zaten bekleyen bir ürün bilgisi talebi var.",
        COMPLAINT_SUGGESTION: "Bu masa için zaten bekleyen bir şikayet/öneri var.",
      };

      return NextResponse.json(
        {
          error: messageMap[requestType] || "Bu masa için zaten bekleyen bir talep var.",
          existingRequestId: existingPendingRequest.id,
        },
        { status: 409 }
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
        reason: reason || null,
        note: combinedNote,
        status: RequestStatus.PENDING,
      },
      include: { table: true },
    });

    // ✅ Masa durumunu güncelle — SADECE masa zaten dolu ise
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