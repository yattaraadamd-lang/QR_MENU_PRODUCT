import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, getBusinessIdFromSession } from "@/lib/tenant";
import { updateOrderStatusRequestSchema, isValidCuid } from "@/lib/validation";
import { OrderStatus } from "@prisma/client";
import { emitToBusinessRoom, SOCKET_EVENTS } from "@/lib/socket-server";
import { cancelOrderAndSyncState, OrderCancellationError } from "@/lib/services/order-cancellation.service";
import { openTable, recalculateTableStatus, updateBillAfterOrder } from "@/lib/services/table-flow.service";
import { withApiHandler, parseJson } from "@/lib/api/handler";

// PUT /api/waiter/orders/[id]/status - Sipariş durumu güncelle
export const PUT = withApiHandler("PUT /api/waiter/orders/[id]/status", handlePut);

async function handlePut(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  
  // ✅ Authentication (Waiter or Admin)
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;

  // ✅ Verify role
  if (!["WAITER", "ADMIN", "SUPER_ADMIN"].includes(authResult.session.role)) {
    return NextResponse.json(
      { error: "Bu işlem için garson veya admin yetkisi gereklidir" },
      { status: 403 }
    );
  }

  const businessId = getBusinessIdFromSession(authResult.session);

  // ✅ Validate order ID
  if (!isValidCuid(params.id)) {
    return NextResponse.json(
      { error: "Geçersiz sipariş ID formatı" },
      { status: 400 }
    );
  }

  // ✅ Validate request body
  // Frontend 'cancelReason' veya 'cancellationReason' gönderebilir — şema ikisini de kabul eder
  const input = await parseJson(request, updateOrderStatusRequestSchema);

  const status = input.status as OrderStatus;
  const cancellationReason = input.cancellationReason;
  const reasonCode = input.reasonCode;
  const outOfStockProductIds = input.outOfStockProductIds;

  // ═══════════════════════════════════════════════════════════════════
  // İPTAL / RED → Merkezi servise delege et
  // ═══════════════════════════════════════════════════════════════════
  if (status === "CANCELLED" || status === "REJECTED") {
    try {
      const result = await cancelOrderAndSyncState({
        orderId: params.id,
        businessId,
        actorId: authResult.session.userId,
        actorRole: authResult.session.role as "WAITER" | "ADMIN" | "SUPER_ADMIN",
        targetStatus: status,
        reasonCode: reasonCode || null,
        reasonText: cancellationReason || null,
        outOfStockProductIds: outOfStockProductIds || null,
      });

      return NextResponse.json({
        message: status === "REJECTED" ? "Sipariş reddedildi" : "Sipariş iptal edildi",
        order: result.order,
        tableStatus: result.tableStatus,
        stockUpdatedProductIds: result.stockUpdatedProductIds,
      });
    } catch (error) {
      if (error instanceof OrderCancellationError) {
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.statusCode }
        );
      }
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // NORMAL DURUM GÜNCELLEMELERİ (ACCEPTED, PREPARING, SERVED)
  // ═══════════════════════════════════════════════════════════════════

  // ✅ Verify order ownership
  const order = await prisma.order.findFirst({
    where: { id: params.id, businessId },
    select: {
      id: true,
      tableId: true,
      tableSessionId: true,
      totalPrice: true,
      status: true,
      table: {
        select: {
          id: true,
          tableNumber: true,
          tableName: true,
        },
      },
    },
  });

  if (!order) {
    return NextResponse.json(
      { error: "Sipariş bulunamadı" },
      { status: 404 }
    );
  }

  // ✅ Zaten tamamlanmış veya iptal edilmiş sipariş tekrar değiştirilemez
  if (["SERVED", "CANCELLED", "REJECTED"].includes(order.status)) {
    return NextResponse.json(
      {
        error: `Bu sipariş zaten "${order.status}" durumunda. Değiştirilemez.`,
      },
      { status: 409 }
    );
  }

  // ✅ Garson onayı siparişi adisyona taşır. Aktif oturum yoksa oturum + adisyon tek transaction'da
  // açılır; eşzamanlı açılışta ikinci bir oturum oluşmaz, kazananınki döner
  let tableSessionId = order.tableSessionId;
  if (order.status === "PENDING") {
    const { tableSession } = await openTable(order.tableId, businessId);
    tableSessionId = tableSession.id;
  }

  // ✅ Sipariş, adisyon ve masa durumu birlikte değişir
  const { updatedOrder, newTableStatus } = await prisma.$transaction(async (tx) => {
    const updatedOrder = await tx.order.update({
      where: { id: params.id },
      data: {
        status,
        waiterId: authResult.session.userId,
        tableSessionId,
      },
      select: {
        id: true,
        totalPrice: true,
        status: true,
        note: true,
        cancelReason: true,
        createdAt: true,
        items: {
          select: {
            id: true,
            productName: true,
            quantity: true,
            unitPrice: true,
            totalPrice: true,
          },
        },
        table: {
          select: {
            tableNumber: true,
            tableName: true,
          },
        },
      },
    });

    // ✅ Kümülatif toplama YOK — her zaman DB'den sıfırdan hesaplanır
    if (tableSessionId) {
      await updateBillAfterOrder(tx, tableSessionId);
    }

    const newTableStatus = await recalculateTableStatus(tx, { businessId, tableId: order.tableId });
    return { updatedOrder, newTableStatus };
  });

  // ✅ Socket.IO notification
  try {
    emitToBusinessRoom(businessId, SOCKET_EVENTS.ORDER_STATUS_UPDATE, {
      orderId: order.id,
      tableNumber: order.table.tableNumber,
      tableName: order.table.tableName,
      status,
      tableStatus: newTableStatus,
      message: `${
        order.table.tableName || "Masa " + order.table.tableNumber
      } sipariş durumu: ${status}`,
    });
  } catch (e) {
    console.log("Socket emit hatası:", e);
  }

  return NextResponse.json({
    message: "Sipariş durumu güncellendi",
    order: updatedOrder,
  });
}