import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ServiceRequestType, RequestStatus, TableStatus } from "@prisma/client";
import { emitToBusinessRoom } from "@/lib/socket-server";
import { validateViewSession, validateAuthorizedTableSession } from "@/lib/security/validate-customer-session";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";

export const dynamic = "force-dynamic";

/**
 * Generates a cryptographically secure 4-digit verification code.
 */
function generateVerificationCode(): string {
  return crypto.randomInt(1000, 10000).toString();
}

// POST /api/customer/service-requests
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { businessId, tableId, requestType, note, reason, idempotencyKey } = body;

    if (!businessId || !tableId || !requestType) {
      return NextResponse.json({ error: "Geçersiz talep bilgileri" }, { status: 400 });
    }

    // ✅ RequestType validasyonu
    const validRequestTypes = [
      "CALL_WAITER", "PAYMENT_REQUEST", "HELP_REQUEST",
      "CLEANING_REQUEST", "ORDER_REQUEST", "PRODUCT_INFO",
      "COMPLAINT_SUGGESTION",
    ];
    if (!validRequestTypes.includes(requestType)) {
      return NextResponse.json({ error: "Geçersiz talep türü." }, { status: 400 });
    }

    // ✅ Note ve reason validasyonu
    if (note && note.length > 500) {
      return NextResponse.json({ error: "Not alanı maksimum 500 karakter olabilir." }, { status: 400 });
    }
    if (reason && reason.length > 200) {
      return NextResponse.json({ error: "Sebep alanı maksimum 200 karakter olabilir." }, { status: 400 });
    }

    const isOrderRequest = requestType === "ORDER_REQUEST";

    // ═══════════════════════════════════════════════════════════════════════
    // YETKI KONTROLÜ — ORDER_REQUEST vs diğer talepler
    // ═══════════════════════════════════════════════════════════════════════

    let customerSession: any;

    if (isOrderRequest) {
      // ORDER_REQUEST: VIEW_ONLY veya PENDING oturum kabul edilir
      const sessionCheck = await validateViewSession(request);
      if (!sessionCheck.ok) {
        return NextResponse.json(
          { error: sessionCheck.error, code: sessionCheck.code },
          { status: sessionCheck.status }
        );
      }
      customerSession = sessionCheck.customerSession;

      // Oturum REVOKED ise reddet
      if (customerSession.authorizationStatus === "REVOKED") {
        return NextResponse.json(
          { error: "Bu oturumun yetkisi iptal edilmiş. Personelden yardım isteyin.", code: "SESSION_REVOKED" },
          { status: 403 }
        );
      }

      // Zaten AUTHORIZED ise ORDER_REQUEST gerekli değil — doğrudan sipariş verebilir
      if (customerSession.authorizationStatus === "AUTHORIZED") {
        return NextResponse.json(
          { error: "Masanız zaten açık. Doğrudan sipariş verebilirsiniz.", code: "SESSION_ALREADY_AUTHORIZED" },
          { status: 400 }
        );
      }
    } else {
      // Diğer talepler: yalnız AUTHORIZED oturum kabul edilir
      const sessionCheck = await validateAuthorizedTableSession(request);
      if (!sessionCheck.ok) {
        return NextResponse.json(
          { error: sessionCheck.error, code: sessionCheck.code },
          { status: sessionCheck.status }
        );
      }
      customerSession = sessionCheck.customerSession;
    }

    // Validate tableId and businessId match session
    if (customerSession.tableId !== tableId || customerSession.businessId !== businessId) {
      return NextResponse.json(
        { error: "Oturum bu masa veya işletme için geçerli değil." },
        { status: 403 }
      );
    }

    // ✅ RATE LIMIT
    const sessionToken = request.headers.get("x-session-token")!;
    if (isOrderRequest) {
      const rl1 = await checkRateLimit(`order_req:${sessionToken}`, RATE_LIMITS.ORDER_REQUEST_CREATE);
      if (!rl1.allowed) {
        const waitSeconds = Math.ceil((rl1.resetAt - Date.now()) / 1000);
        return NextResponse.json(
          { error: `Lütfen ${waitSeconds} saniye bekleyip tekrar deneyin.`, code: "RATE_LIMITED" },
          { status: 429 }
        );
      }
      const rl2 = await checkRateLimit(`order_req_burst:${sessionToken}`, RATE_LIMITS.ORDER_REQUEST_BURST);
      if (!rl2.allowed) {
        const waitMinutes = Math.ceil((rl2.resetAt - Date.now()) / 60000);
        return NextResponse.json(
          { error: `Çok fazla talep gönderdiniz. ${waitMinutes} dakika sonra tekrar deneyin.`, code: "RATE_LIMITED" },
          { status: 429 }
        );
      }
    } else {
      const rateLimit = await checkRateLimit(`service:${sessionToken}`, RATE_LIMITS.SERVICE_REQUEST);
      if (!rateLimit.allowed) {
        const waitSeconds = Math.ceil((rateLimit.resetAt - Date.now()) / 1000);
        return NextResponse.json(
          { error: `Lütfen ${waitSeconds} saniye bekleyip tekrar deneyin.`, code: "RATE_LIMITED" },
          { status: 429 }
        );
      }
    }

    const table = customerSession.table;
    const business = customerSession.business;

    if (!business.isActive) {
      return NextResponse.json({ error: "İşletme şu anda hizmet vermiyor." }, { status: 403 });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ORDER_REQUEST — Özel akış
    // ═══════════════════════════════════════════════════════════════════════

    if (isOrderRequest) {
      // Masa için aktif TableSession varsa ve bu müşteri yetkili değilse
      const existingTableSession = await prisma.tableSession.findFirst({
        where: { tableId, businessId, status: "ACTIVE" },
      });

      if (existingTableSession) {
        // Bu müşteri bu masa oturumuna yetkili mi?
        if (
          customerSession.authorizationStatus !== "AUTHORIZED" ||
          customerSession.tableSessionId !== existingTableSession.id
        ) {
          return NextResponse.json(
            {
              error: "Bu masa başka bir aktif oturuma ait. Personelden yardım isteyin.",
              code: "TABLE_ALREADY_CLAIMED",
            },
            { status: 409 }
          );
        }
      }

      // Aynı oturumun geçerli bekleyen talebi varsa onu döndür
      const existingPending = await prisma.serviceRequest.findFirst({
        where: {
          customerSessionId: customerSession.id,
          requestType: "ORDER_REQUEST",
          status: { in: ["PENDING", "SEEN"] },
          expiresAt: { gt: new Date() },
        },
      });

      if (existingPending) {
        return NextResponse.json(
          {
            message: "Bekleyen sipariş talebiniz var. Garson onayı bekleniyor.",
            code: "ORDER_REQUEST_PENDING",
            serviceRequest: {
              id: existingPending.id,
              verificationCode: existingPending.verificationCode,
              expiresAt: existingPending.expiresAt?.toISOString(),
              status: existingPending.status,
            },
          },
          { status: 200 }
        );
      }

      // İdempotency check
      if (idempotencyKey) {
        const existingByKey = await prisma.serviceRequest.findUnique({
          where: { idempotencyKey },
        });
        if (existingByKey) {
          return NextResponse.json(
            {
              message: "Talep zaten oluşturulmuş.",
              serviceRequest: {
                id: existingByKey.id,
                verificationCode: existingByKey.verificationCode,
                expiresAt: existingByKey.expiresAt?.toISOString(),
                status: existingByKey.status,
              },
            },
            { status: 200 }
          );
        }
      }

      // Süresi geçmiş bekleyen talepleri iptal et
      await prisma.serviceRequest.updateMany({
        where: {
          tableId,
          requestType: "ORDER_REQUEST",
          status: { in: ["PENDING", "SEEN"] },
          expiresAt: { lt: new Date() },
        },
        data: { status: "CANCELLED" },
      });

      // ORDER_REQUEST oluştur
      const verificationCode = generateVerificationCode();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 dakika
      const reqIdempotencyKey = idempotencyKey || `or_${uuidv4()}`;
      const combinedNote = [reason, note].filter(Boolean).join(" — ") || null;

      const serviceRequest = await prisma.serviceRequest.create({
        data: {
          businessId,
          tableId,
          customerSessionId: customerSession.id,
          requestType: "ORDER_REQUEST",
          reason: reason || null,
          note: combinedNote,
          status: RequestStatus.PENDING,
          expiresAt,
          verificationCode,
          idempotencyKey: reqIdempotencyKey,
        },
        include: { table: true },
      });

      // CustomerSession'ı PENDING yap
      await prisma.customerSession.update({
        where: { id: customerSession.id },
        data: { authorizationStatus: "PENDING" },
      });

      // Bildirim oluştur
      await prisma.notification.create({
        data: {
          businessId,
          tableId,
          type: "SERVICE_REQUEST",
          title: "Sipariş Talebi — Masa Açma",
          message: `${table.tableName || "Masa " + table.tableNumber} sipariş vermek istiyor. Doğrulama kodu: ${verificationCode}`,
          soundType: "ORDER",
        },
      });

      // Socket.IO
      try {
        emitToBusinessRoom(businessId, "order_request_update", {
          requestId: serviceRequest.id,
          tableNumber: table.tableNumber,
          tableName: table.tableName,
          verificationCode,
          expiresAt: expiresAt.toISOString(),
          message: `${table.tableName || "Masa " + table.tableNumber} sipariş talebi oluşturdu`,
          soundType: "new_order",
          requestType: "ORDER_REQUEST",
          createdAt: serviceRequest.createdAt,
        });
      } catch (e) {
        console.log("Socket emit hatası:", e);
      }

      return NextResponse.json(
        {
          message: "Sipariş talebiniz garsona iletildi. Doğrulama kodunuzu garsonla paylaşın.",
          code: "ORDER_REQUEST_PENDING",
          serviceRequest: {
            id: serviceRequest.id,
            verificationCode,
            expiresAt: expiresAt.toISOString(),
            status: "PENDING",
          },
        },
        { status: 201 }
      );
    }

    // ═══════════════════════════════════════════════════════════════════════
    // DİĞER HİZMET TALEPLERİ — AUTHORIZED oturum gerekli (yukarıda doğrulandı)
    // ═══════════════════════════════════════════════════════════════════════

    // Aynı masa için PENDING durumunda talep var mı kontrol et
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
        CALL_WAITER: "Bu masa için zaten bekleyen bir garson çağrısı var.",
        PAYMENT_REQUEST: "Bu masa için zaten bekleyen bir ödeme talebi var.",
        HELP_REQUEST: "Bu masa için zaten bekleyen bir yardım talebi var.",
        CLEANING_REQUEST: "Bu masa için zaten bekleyen bir temizlik talebi var.",
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

    const combinedNote = [reason, note].filter(Boolean).join(" — ") || null;

    const serviceRequest = await prisma.serviceRequest.create({
      data: {
        businessId,
        tableId,
        customerSessionId: customerSession.id,
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
  } catch (error: any) {
    // Handle partial unique index violation for ORDER_REQUEST
    if (error?.code === "P2002" && error?.meta?.target?.includes("unique_pending_order_request")) {
      return NextResponse.json(
        { error: "Bu masa için zaten bekleyen bir sipariş talebi var.", code: "ORDER_REQUEST_PENDING" },
        { status: 409 }
      );
    }
    console.error("Hizmet talebi oluşturma hatası:", error);
    return NextResponse.json({ error: "Talep oluşturulurken bir hata oluştu" }, { status: 500 });
  }
}