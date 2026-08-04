import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { OrderStatus, TableStatus } from "@prisma/client";
import { getAuthSession } from "@/lib/auth-helpers";
import { cancelOrderAndSyncState, OrderCancellationError } from "@/lib/services/order-cancellation.service";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const params = await context.params;
    const { orderId } = params;
    const session = await getAuthSession();
    const body = await request.json();
    const { status, waiterId, cancelReason, reasonCode, outOfStockProductIds } = body;

    if (!status) {
      return NextResponse.json(
        { error: "Durum bilgisi gerekli" },
        { status: 400 }
      );
    }

    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, businessId: true },
    });

    if (!existingOrder) {
      return NextResponse.json(
        { error: "Sipariş bulunamadı" },
        { status: 404 }
      );
    }

    const businessId = existingOrder.businessId;
    const actorId = session?.user?.id || waiterId || "SYSTEM";
    const actorRole = (session?.user?.role as any) || "WAITER";

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
    const updateData: any = { status };
    if (waiterId) {
      updateData.waiterId = waiterId;
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
    console.error("Sipariş güncelleme hatası:", error);
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
    const params = await context.params;
    const { orderId } = params;
    const session = await getAuthSession();
    const { searchParams } = new URL(request.url);
    const cancelReason = searchParams.get("reason") || "İptal edildi";
    const reasonCode = (searchParams.get("reasonCode") as any) || null;
    const rawStockPids = searchParams.get("outOfStockProductIds");
    const outOfStockProductIds = rawStockPids ? rawStockPids.split(",").filter(Boolean) : null;

    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, businessId: true },
    });

    if (!existingOrder) {
      return NextResponse.json(
        { error: "Sipariş bulunamadı" },
        { status: 404 }
      );
    }

    const businessId = existingOrder.businessId;
    const actorId = session?.user?.id || "SYSTEM";
    const actorRole = (session?.user?.role as any) || "ADMIN";

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
    console.error("Sipariş iptal hatası:", error);
    return NextResponse.json(
      { error: "Sipariş iptal edilirken bir hata oluştu" },
      { status: 500 }
    );
  }
}
