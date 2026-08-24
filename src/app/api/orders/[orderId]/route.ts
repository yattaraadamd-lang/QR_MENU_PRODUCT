import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { OrderStatus, TableStatus } from "@prisma/client";
import { requireWaiterOrAdmin, getBusinessId } from "@/lib/auth-helpers";
import { cancelOrderAndSyncState, OrderCancellationError } from "@/lib/services/order-cancellation.service";

/**
 * 🔒 P0-09 FIX: Order Detail API — Auth + Tenant Isolation
 *
 * PREVIOUSLY: Used getAuthSession() without enforcing auth.
 * No tenant check — anyone with an orderId could modify any order.
 *
 * NOW: requireWaiterOrAdmin(), businessId from session.
 * Order ownership verified against session businessId.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    // ✅ P0-09 FIX: Require waiter or admin authentication
    const { error, response, session } = await requireWaiterOrAdmin();
    if (error) return response!;

    const businessId = getBusinessId(session);
    const params = await context.params;
    const { orderId } = params;
    const body = await request.json();
    const { status, cancelReason, reasonCode, outOfStockProductIds } = body;

    if (!status) {
      return NextResponse.json(
        { error: "Durum bilgisi gerekli" },
        { status: 400 }
      );
    }

    // ✅ P0-09 FIX: Verify order belongs to authenticated user's business
    const existingOrder = await prisma.order.findFirst({
      where: { id: orderId, businessId },
      select: { id: true, businessId: true, tableId: true },
    });

    if (!existingOrder) {
      return NextResponse.json(
        { error: "Sipariş bulunamadı" },
        { status: 404 }
      );
    }

    const actorId = session.user.id;
    const actorRole = session.user.role;

    // İptal / Red durumu
    if (status === OrderStatus.CANCELLED || status === OrderStatus.REJECTED) {
      try {
        const result = await cancelOrderAndSyncState({
          orderId,
          businessId,
          actorId,
          actorRole,
          targetStatus: status,
          reasonCode: reasonCode || null,
          reasonText: cancelReason || null,
          outOfStockProductIds: outOfStockProductIds || null,
        });

        return NextResponse.json({
          message: status === OrderStatus.REJECTED ? "Sipariş reddedildi" : "Sipariş iptal edildi",
          order: result.order,
          tableStatus: result.tableStatus,
          stockUpdatedProductIds: result.stockUpdatedProductIds,
        });
      } catch (err) {
        if (err instanceof OrderCancellationError) {
          return NextResponse.json(
            { error: err.message, code: err.code },
            { status: err.statusCode }
          );
        }
        throw err;
      }
    }

    // Normal durum güncellemeleri
    const updateData: Record<string, unknown> = { status };

    // ✅ P0-09 FIX: waiterId from session, not from body (prevents IDOR)
    if (status === OrderStatus.ACCEPTED || status === OrderStatus.PREPARING) {
      updateData.waiterId = session.user.id;
    }

    const order = await prisma.order.update({
      where: { id: orderId },
      data: updateData,
      include: {
        items: {
          include: {
            product: true,
          },
        },
        table: true,
        waiter: true,
      },
    });

    const otherActiveOrders = await prisma.order.count({
      where: {
        tableId: order.tableId,
        id: { not: orderId },
        status: { in: ["PENDING", "ACCEPTED", "PREPARING"] },
      },
    });

    let tableStatus: TableStatus = TableStatus.OCCUPIED;

    if (status === OrderStatus.PREPARING) {
      tableStatus = TableStatus.PREPARING;
    } else if (status === OrderStatus.PENDING || status === OrderStatus.ACCEPTED) {
      tableStatus = TableStatus.HAS_ORDER;
    } else if (status === OrderStatus.SERVED) {
      if (otherActiveOrders === 0) {
        tableStatus = TableStatus.SERVED;
      } else {
        tableStatus = TableStatus.PREPARING;
      }
    }

    await prisma.table.update({
      where: { id: order.tableId },
      data: { status: tableStatus },
    });

    if (status === OrderStatus.SERVED) {
      await prisma.notification.create({
        data: {
          businessId: order.businessId,
          tableId: order.tableId,
          type: "ORDER_STATUS_UPDATE",
          title: "Sipariş Tamamlandı",
          message: `Masa ${order.table.tableNumber} siparişi servis edildi`,
          soundType: "DEFAULT",
        },
      });
    }

    return NextResponse.json({
      message: "Sipariş durumu güncellendi",
      order,
    });
  } catch (error) {
    console.error("[ORDER_UPDATE_ERROR]", error);
    return NextResponse.json(
      { error: "Sipariş güncellenirken bir hata oluştu" },
      { status: 500 }
    );
  }
}

// Sipariş iptal etme endpoint'i
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    // ✅ P0-09 FIX: Require waiter or admin authentication
    const { error, response, session } = await requireWaiterOrAdmin();
    if (error) return response!;

    const businessId = getBusinessId(session);
    const params = await context.params;
    const { orderId } = params;
    const { searchParams } = new URL(request.url);
    const cancelReason = searchParams.get("reason") || "İptal edildi";
    const reasonCode = (searchParams.get("reasonCode") as any) || null;
    const rawStockPids = searchParams.get("outOfStockProductIds");
    const outOfStockProductIds = rawStockPids ? rawStockPids.split(",").filter(Boolean) : null;

    // ✅ P0-09 FIX: Verify order belongs to authenticated user's business
    const existingOrder = await prisma.order.findFirst({
      where: { id: orderId, businessId },
      select: { id: true, businessId: true },
    });

    if (!existingOrder) {
      return NextResponse.json(
        { error: "Sipariş bulunamadı" },
        { status: 404 }
      );
    }

    const actorId = session.user.id;
    const actorRole = session.user.role;

    try {
      const result = await cancelOrderAndSyncState({
        orderId,
        businessId,
        actorId,
        actorRole,
        targetStatus: "CANCELLED",
        reasonCode,
        reasonText: cancelReason,
        outOfStockProductIds,
      });

      return NextResponse.json({
        message: "Sipariş iptal edildi",
        order: result.order,
        tableStatus: result.tableStatus,
        stockUpdatedProductIds: result.stockUpdatedProductIds,
      });
    } catch (err) {
      if (err instanceof OrderCancellationError) {
        return NextResponse.json(
          { error: err.message, code: err.code },
          { status: err.statusCode }
        );
      }
      throw err;
    }
  } catch (error) {
    console.error("[ORDER_DELETE_ERROR]", error);
    return NextResponse.json(
      { error: "Sipariş iptal edilirken bir hata oluştu" },
      { status: 500 }
    );
  }
}
