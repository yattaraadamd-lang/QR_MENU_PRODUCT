import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWaiterOrAdmin, getBusinessId } from "@/lib/auth-helpers";
import { RequestStatus, TableStatus } from "@prisma/client";
import { emitToBusinessRoom, SOCKET_EVENTS } from "@/lib/socket-server";
import { recalculateTableStatus } from "@/lib/services/table-flow.service";

// PUT /api/waiter/service-requests/[id]/status - Talep durumu güncelle
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { error, response, session } = await requireWaiterOrAdmin();
    if (error) return response!;

    const businessId = getBusinessId(session);
    const body = await request.json();
    const { status } = body;

    if (!status || !["SEEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"].includes(status)) {
      return NextResponse.json(
        { error: "Geçersiz talep durumu" },
        { status: 400 }
      );
    }

    // Talebi kontrol et (transaction dışında — varlık doğrulaması)
    const serviceRequest = await prisma.serviceRequest.findFirst({
      where: { id: params.id, businessId },
      include: { table: true },
    });

    if (!serviceRequest) {
      return NextResponse.json(
        { error: "Talep bulunamadı" },
        { status: 404 }
      );
    }

    // ── İdempotency: Talep zaten CANCELLED/COMPLETED ise ──────────────
    // Talep kaydını tekrar güncelleme, hata döndürme.
    // Masa durumunu gerçek kayıtlardan tekrar hesapla.
    const alreadyTerminal = serviceRequest.status === "CANCELLED" || serviceRequest.status === "COMPLETED";

    // ── Tek transaction içinde talep güncelle + masa durumu hesapla ────
    const result = await prisma.$transaction(async (tx) => {
      // Talep kaydını güncelle (zaten terminal değilse)
      let updatedRequest;
      if (alreadyTerminal) {
        // İdempotent: mevcut kaydı olduğu gibi döndür
        updatedRequest = await tx.serviceRequest.findFirst({
          where: { id: params.id },
          include: { table: true },
        });
      } else {
        updatedRequest = await tx.serviceRequest.update({
          where: { id: params.id },
          data: {
            status: status as RequestStatus,
            ...(status === "COMPLETED" && { completedAt: new Date() }),
            ...(status === "CANCELLED" && { resolvedAt: new Date() }),
          },
          include: { table: true },
        });

        // ── ORDER_REQUEST iptal: bağlı CustomerSession'ı VIEW_ONLY yap ──
        // Sadece PENDING durumdaki aktif session'a dokunulur.
        // AUTHORIZED veya REVOKED session'lar değiştirilmez.
        // Yeni TableSession/Bill oluşturulmaz; masa durumu recalculateTableStatus ile belirlenir.
        if (
          status === "CANCELLED" &&
          serviceRequest.requestType === "ORDER_REQUEST" &&
          serviceRequest.customerSessionId
        ) {
          await tx.customerSession.updateMany({
            where: {
              id: serviceRequest.customerSessionId,
              status: "ACTIVE",
              authorizationStatus: "PENDING",
            },
            data: {
              authorizationStatus: "VIEW_ONLY",
            },
          });
        }
      }

      // Masa durumunu yeniden hesapla (COMPLETED veya CANCELLED ise)
      let calculatedTableStatus: TableStatus | null = null;
      if (status === "COMPLETED" || status === "CANCELLED") {
        calculatedTableStatus = await recalculateTableStatus(tx, {
          businessId,
          tableId: serviceRequest.tableId,
        });
      }

      return { updatedRequest, calculatedTableStatus };
    });

    // ── Socket.IO bildirimleri (transaction sonrası) ──────────────────

    // 1. Mevcut request_status_update olayı
    emitToBusinessRoom(businessId, "request_status_update", {
      requestId: serviceRequest.id,
      tableNumber: serviceRequest.table.tableNumber,
      tableName: serviceRequest.table.tableName,
      status: alreadyTerminal ? serviceRequest.status : status,
      requestType: serviceRequest.requestType,
    });

    // 2. Masa durumu değişikliğini yayınla
    if (result.calculatedTableStatus !== null) {
      emitToBusinessRoom(businessId, "table_status_update", {
        tableId: serviceRequest.tableId,
        status: result.calculatedTableStatus,
        requestId: serviceRequest.id,
        requestType: serviceRequest.requestType,
      });
    }

    return NextResponse.json({
      message: alreadyTerminal
        ? "Talep zaten bu durumda"
        : "Talep durumu güncellendi",
      serviceRequest: result.updatedRequest,
    });
  } catch (error) {
    console.error("Talep güncelleme hatası:", error);
    return NextResponse.json(
      { error: "Talep güncellenirken bir hata oluştu" },
      { status: 500 }
    );
  }
}
