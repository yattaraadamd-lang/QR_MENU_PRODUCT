import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWaiterOrAdmin, getBusinessId } from "@/lib/auth-helpers";
import { emitToBusinessRoom } from "@/lib/socket-server";
import { recalculateTableStatus } from "@/lib/services/table-flow.service";
import { createDeviceBlock } from "@/lib/security/device-block";

/**
 * POST /api/waiter/service-requests/[id]/reject-order-request
 *
 * Garson sipariş talebini masada müşteri olmadığı gerekçesiyle reddeder.
 * Tek transaction içinde:
 *  - Talep doğrulanır (ORDER_REQUEST, PENDING/SEEN)
 *  - Talep CANCELLED yapılır
 *  - Bağlı CustomerSession REVOKED yapılır
 *  - Cihaz için CustomerAccessBlock (işletme düzeyi cihaz engeli) oluşturulur
 *  - Masa durumu yeniden hesaplanır (aktif oturum yoksa EMPTY)
 *  - Socket bildirimleri yayınlanır
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const requestId = params.id;

    // ─── Auth: Garson veya admin zorunlu
    const { error, response, session } = await requireWaiterOrAdmin();
    if (error) return response!;
    const authenticatedBusinessId = getBusinessId(session);
    const userId = session?.user?.id;

    const body = await request.json().catch(() => ({}));
    const rejectReason = body.reason || "EMPTY_TABLE_ABUSE";

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
        { error: "Yalnız ORDER_REQUEST türündeki talepler bu endpoint ile reddedilebilir." },
        { status: 400 }
      );
    }

    if (serviceRequest.status !== "PENDING" && serviceRequest.status !== "SEEN") {
      return NextResponse.json(
        { error: "Bu talep zaten işlenmiş veya iptal edilmiş.", code: "OPEN_REQUEST_ALREADY_HANDLED" },
        { status: 409 }
      );
    }

    // ─── ATOMİK TRANSACTION
    const result = await prisma.$transaction(async (tx) => {
      // 1. Talebi CANCELLED yap
      const updatedRequest = await tx.serviceRequest.update({
        where: { id: requestId },
        data: {
          status: "CANCELLED",
          reason: rejectReason,
          resolvedAt: new Date(),
        },
      });

      // 2. Bağlı CustomerSession'ı REVOKED yap
      let deviceKeyHash: string | null = null;
      if (serviceRequest.customerSessionId) {
        const updatedSession = await tx.customerSession.update({
          where: { id: serviceRequest.customerSessionId },
          data: {
            status: "REVOKED",
            authorizationStatus: "REVOKED",
            closedAt: new Date(),
          },
        });
        deviceKeyHash = updatedSession.deviceKeyHash;
      }

      // 3. Cihaz engeli oluştur (deviceKeyHash varsa)
      if (deviceKeyHash) {
        await createDeviceBlock({
          businessId: authenticatedBusinessId,
          deviceKeyHash,
          reason: rejectReason,
          sourceRequestId: requestId,
          createdById: userId,
          tx,
        });
      }

      // 4. Masa durumunu yeniden hesapla
      const newTableStatus = await recalculateTableStatus(tx, {
        businessId: authenticatedBusinessId,
        tableId: serviceRequest.tableId,
      });

      return { updatedRequest, newTableStatus };
    });

    // ─── Socket bildirimleri
    try {
      emitToBusinessRoom(authenticatedBusinessId, "request_status_update", {
        requestId,
        tableNumber: serviceRequest.table.tableNumber,
        tableName: serviceRequest.table.tableName,
        status: "CANCELLED",
        requestType: "ORDER_REQUEST",
      });

      if (result.newTableStatus !== null) {
        emitToBusinessRoom(authenticatedBusinessId, "table_status_update", {
          tableId: serviceRequest.tableId,
          status: result.newTableStatus,
          requestId,
          requestType: "ORDER_REQUEST",
        });
      }

      if (serviceRequest.customerSessionId) {
        emitToBusinessRoom(authenticatedBusinessId, "session_authorized", {
          tableId: serviceRequest.tableId,
          customerSessionId: serviceRequest.customerSessionId,
          authorizationStatus: "REVOKED",
        });
      }
    } catch (e) {
      console.log("Socket emit hatası:", e);
    }

    return NextResponse.json({
      message: "Sipariş talebi reddedildi ve cihaz bu işletmede engellendi.",
      code: "ORDER_REQUEST_REJECTED_AND_BLOCKED",
    });
  } catch (error) {
    console.error("Sipariş talebi reddetme hatası:", error);
    return NextResponse.json(
      { error: "Sipariş talebi reddedilirken bir hata oluştu" },
      { status: 500 }
    );
  }
}
