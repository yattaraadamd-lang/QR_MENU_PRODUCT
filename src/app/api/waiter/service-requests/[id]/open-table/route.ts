import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWaiterOrAdmin, getBusinessId } from "@/lib/auth-helpers";
import { emitToBusinessRoom } from "@/lib/socket-server";

import { checkRateLimit } from "@/lib/security/rate-limit";

/**
 * POST /api/waiter/service-requests/[id]/open-table
 *
 * Atomik garson onayı: ORDER_REQUEST'i onaylayıp masayı açar.
 * Tek transaction içinde:
 *  - Talep doğrulanır (ORDER_REQUEST, PENDING, süresi geçmemiş, aktif customerSession bağlı)
 *  - Doğrulama kodu kontrol edilir
 *  - Masa için başka aktif TableSession olmadığı doğrulanır
 *  - TableSession + Bill oluşturulur, masa OCCUPIED yapılır
 *  - Talebi oluşturan CustomerSession AUTHORIZED yapılır
 *  - Diğer bekleyen ORDER_REQUEST'ler iptal edilir
 *  - Talep COMPLETED yapılır
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const requestId = params.id;

    // ─── Body'den verificationCode al
    let verificationCode: string | null = null;
    try {
      const body = await request.json();
      if (body?.verificationCode) {
        verificationCode = String(body.verificationCode).trim();
      }
    } catch {
      // body okuma hatası veya boş body
    }

    if (!verificationCode) {
      return NextResponse.json(
        { error: "Doğrulama kodu gerekli.", code: "VERIFICATION_CODE_REQUIRED" },
        { status: 400 }
      );
    }

    // ─── Auth: Garson veya admin zorunlu
    const { error, response, session } = await requireWaiterOrAdmin();
    if (error) return response!;
    const authenticatedBusinessId = getBusinessId(session);

    // ─── Talebi bul ve doğrula
    const serviceRequest = await prisma.serviceRequest.findFirst({
      where: { id: requestId, businessId: authenticatedBusinessId },
      include: {
        table: true,
        customerSession: true,
      },
    });

    if (!serviceRequest) {
      return NextResponse.json({ error: "Talep bulunamadı" }, { status: 404 });
    }

    if (serviceRequest.requestType !== "ORDER_REQUEST") {
      return NextResponse.json(
        { error: "Bu talep türü ile masa açılamaz. Yalnız ORDER_REQUEST onaylanabilir." },
        { status: 400 }
      );
    }

    // ─── Rate-limit & Doğrulama kodu kontrolü
    const rl = await checkRateLimit(`open_table_code:${requestId}`, {
      maxRequests: 5,
      windowMs: 5 * 60 * 1000,
    });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Çok fazla yanlış doğrulama kodu denemesi. Lütfen 5 dakika bekleyin.", code: "TOO_MANY_ATTEMPTS" },
        { status: 429 }
      );
    }

    if (serviceRequest.verificationCode && serviceRequest.verificationCode !== verificationCode) {
      return NextResponse.json(
        { error: "Doğrulama kodu yanlış.", code: "INVALID_VERIFICATION_CODE" },
        { status: 400 }
      );
    }

    // ─── Zaten tamamlanmışsa idempotent yanıt
    if (serviceRequest.status === "COMPLETED") {
      const existingSession = await prisma.tableSession.findFirst({
        where: { tableId: serviceRequest.tableId, businessId: authenticatedBusinessId, status: "ACTIVE" },
        include: { bill: true },
      });
      if (existingSession) {
        return NextResponse.json({
          message: "Bu talep zaten onaylanmış.",
          code: "OPEN_REQUEST_ALREADY_HANDLED",
          tableSession: existingSession,
          bill: existingSession.bill,
        });
      }
    }

    if (serviceRequest.status !== "PENDING" && serviceRequest.status !== "SEEN") {
      return NextResponse.json(
        { error: "Bu talep zaten işlenmiş veya iptal edilmiş.", code: "OPEN_REQUEST_ALREADY_HANDLED" },
        { status: 409 }
      );
    }

    // Süresi geçmiş mi?
    if (serviceRequest.expiresAt && serviceRequest.expiresAt < new Date()) {
      await prisma.serviceRequest.update({
        where: { id: requestId },
        data: { status: "CANCELLED" },
      });
      return NextResponse.json(
        { error: "Talebin süresi dolmuş. Müşterinin yeni talep oluşturması gerekiyor.", code: "OPEN_REQUEST_EXPIRED" },
        { status: 410 }
      );
    }

    // Aktif customerSession bağlı mı?
    if (!serviceRequest.customerSessionId || !serviceRequest.customerSession) {
      return NextResponse.json(
        { error: "Taleple bağlı müşteri oturumu bulunamadı." },
        { status: 400 }
      );
    }

    if (serviceRequest.customerSession.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Bağlı müşteri oturumu artık aktif değil." },
        { status: 400 }
      );
    }

    // ─── ATOMİK TRANSACTION
    const result = await prisma.$transaction(async (tx) => {
      // 1. Talebi kilitle ve tekrar kontrol et
      const lockedRequest = await tx.serviceRequest.findUnique({
        where: { id: requestId },
      });

      if (!lockedRequest || lockedRequest.status !== "PENDING" && lockedRequest.status !== "SEEN") {
        throw new Error("ALREADY_HANDLED");
      }

      // 2. Masa için başka aktif TableSession olmadığını doğrula
      const existingActiveSession = await tx.tableSession.findFirst({
        where: { tableId: serviceRequest.tableId, businessId: authenticatedBusinessId, status: "ACTIVE" },
      });

      if (existingActiveSession) {
        throw new Error("TABLE_ALREADY_HAS_SESSION");
      }

      // 3. TableSession + Bill oluştur
      const tableSession = await tx.tableSession.create({
        data: {
          businessId: authenticatedBusinessId,
          tableId: serviceRequest.tableId,
          status: "ACTIVE",
        },
      });

      const bill = await tx.bill.create({
        data: {
          businessId: authenticatedBusinessId,
          tableId: serviceRequest.tableId,
          tableSessionId: tableSession.id,
          totalAmount: 0,
          paidAmount: 0,
          remainingAmount: 0,
          paymentStatus: "UNPAID",
          status: "OPEN",
        },
      });

      // 4. Masa durumunu OCCUPIED yap
      await tx.table.update({
        where: { id: serviceRequest.tableId },
        data: { status: "OCCUPIED" },
      });

      // 5. Talebi oluşturan CustomerSession'ı AUTHORIZED yap
      await tx.customerSession.update({
        where: { id: serviceRequest.customerSessionId! },
        data: {
          authorizationStatus: "AUTHORIZED",
          tableSessionId: tableSession.id,
          authorizedAt: new Date(),
        },
      });

      // 6. Aynı masadaki diğer CustomerSession'ların eski yetkilerini REVOKED yap
      await tx.customerSession.updateMany({
        where: {
          tableId: serviceRequest.tableId,
          businessId: authenticatedBusinessId,
          status: "ACTIVE",
          id: { not: serviceRequest.customerSessionId! },
          authorizationStatus: { in: ["AUTHORIZED", "PENDING"] },
        },
        data: { authorizationStatus: "REVOKED" },
      });

      // 7. Diğer bekleyen ORDER_REQUEST kayıtlarını iptal et
      await tx.serviceRequest.updateMany({
        where: {
          tableId: serviceRequest.tableId,
          requestType: "ORDER_REQUEST",
          status: { in: ["PENDING", "SEEN"] },
          id: { not: requestId },
        },
        data: { status: "CANCELLED" },
      });

      // 8. Onaylanan talebi COMPLETED yap
      await tx.serviceRequest.update({
        where: { id: requestId },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
        },
      });

      return { tableSession: { ...tableSession, bill }, bill };
    });

    // ─── Socket.IO bildirimleri
    try {
      // Garson ekranlarını güncelle
      emitToBusinessRoom(authenticatedBusinessId, "table_opened", {
        tableId: serviceRequest.tableId,
        tableNumber: serviceRequest.table.tableNumber,
        tableName: serviceRequest.table.tableName,
        tableSessionId: result.tableSession.id,
        requestId,
        message: `${serviceRequest.table.tableName || "Masa " + serviceRequest.table.tableNumber} açıldı`,
      });

      // Müşteri oturumunu güncelle
      emitToBusinessRoom(authenticatedBusinessId, "session_authorized", {
        tableId: serviceRequest.tableId,
        customerSessionId: serviceRequest.customerSessionId,
        tableSessionId: result.tableSession.id,
        authorizationStatus: "AUTHORIZED",
      });
    } catch (e) {
      console.log("Socket emit hatası:", e);
    }

    return NextResponse.json(
      {
        message: "Masa başarıyla açıldı ve müşteri yetkilendirildi.",
        tableSession: result.tableSession,
        bill: result.bill,
        isNew: true,
        // Staff UI bilgisi — müşteri auth kaynağı olarak kullanılmamalı
        authorizationStatus: "AUTHORIZED",
        customerSessionId: serviceRequest.customerSessionId,
        tableSessionId: result.tableSession.id,
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error?.message === "ALREADY_HANDLED") {
      return NextResponse.json(
        { error: "Bu talep zaten başka bir garson tarafından işlenmiş.", code: "OPEN_REQUEST_ALREADY_HANDLED" },
        { status: 409 }
      );
    }
    if (error?.message === "TABLE_ALREADY_HAS_SESSION") {
      return NextResponse.json(
        { error: "Bu masa için zaten aktif bir oturum var.", code: "TABLE_ALREADY_CLAIMED" },
        { status: 409 }
      );
    }
    // Prisma unique constraint violation (concurrent open attempts)
    if (error?.code === "P2002") {
      return NextResponse.json(
        { error: "Eşzamanlı masa açma çakışması. Lütfen tekrar deneyin.", code: "OPEN_REQUEST_ALREADY_HANDLED" },
        { status: 409 }
      );
    }
    console.error("Masa açma hatası:", error);
    return NextResponse.json({ error: "Masa açılırken bir hata oluştu" }, { status: 500 });
  }
}
