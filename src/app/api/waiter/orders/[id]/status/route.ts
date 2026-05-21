import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, getBusinessIdFromSession, verifyResourceOwnership } from "@/lib/tenant";
import { validateBody, updateOrderStatusSchema, isValidCuid } from "@/lib/validation";
import { OrderStatus, TableStatus } from "@prisma/client";
import { emitToBusinessRoom } from "@/lib/socket-server";

// PUT /api/waiter/orders/[id]/status - Sipariş durumu güncelle
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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
    const body = await request.json();
    const validation = validateBody(updateOrderStatusSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const status = validation.data.status as OrderStatus;
    const cancellationReason = validation.data.cancellationReason;

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

    // ✅ Build update data
    const updateData: any = {
    status,
    waiterId: authResult.session.userId,
    };

    // İptal durumunda bilgileri kaydet
    if (status === "CANCELLED") {
      updateData.cancelledAt = new Date();
      updateData.cancelReason = cancellationReason || "Garson tarafından iptal edildi";
    }

    // ✅ Update order
    const updatedOrder = await prisma.order.update({
      where: { id: params.id },
      data: updateData,
      select: {
        id: true,
        totalPrice: true,
        status: true,
        note: true,
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

    // ✅ Update table status based on order status
    const otherActiveOrders = await prisma.order.count({
      where: {
        tableId: order.tableId,
        id: { not: params.id },
        status: { in: ["PENDING", "ACCEPTED", "PREPARING"] },
      },
    });

    let newTableStatus: TableStatus | null = null;

    if (status === "PREPARING") {
      newTableStatus = TableStatus.PREPARING;
    } else if (status === "SERVED") {
      if (otherActiveOrders === 0) {
        newTableStatus = TableStatus.SERVED;
      }
    } else if (status === "CANCELLED") {
      if (otherActiveOrders === 0) {
        newTableStatus = TableStatus.OCCUPIED;
      }
    } else if (status === "ACCEPTED") {
      newTableStatus = TableStatus.HAS_ORDER;
    }

    if (newTableStatus) {
      await prisma.table.update({
        where: { id: order.tableId },
        data: { status: newTableStatus },
      });
    }

    // ✅ Update bill if order is cancelled
    if (status === "CANCELLED" && order.tableSessionId) {
      const bill = await prisma.bill.findFirst({
        where: { tableSessionId: order.tableSessionId },
        select: { id: true, totalAmount: true, paidAmount: true },
      });

      if (bill) {
        const newTotal = Math.max(0, Number(bill.totalAmount) - Number(order.totalPrice));
        const remaining = Math.max(0, newTotal - Number(bill.paidAmount));
        let paymentStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID" = "UNPAID";
        if (remaining === 0 && newTotal > 0) paymentStatus = "PAID";
        else if (Number(bill.paidAmount) > 0) paymentStatus = "PARTIALLY_PAID";

        await prisma.bill.update({
          where: { id: bill.id },
          data: { totalAmount: newTotal, remainingAmount: remaining, paymentStatus },
        });
      }
    }

    // ✅ Socket.IO notification
    emitToBusinessRoom(businessId, "order_status_update", {
      orderId: order.id,
      tableNumber: order.table.tableNumber,
      tableName: order.table.tableName,
      status,
      tableStatus: newTableStatus,
      message: `${order.table.tableName || "Masa " + order.table.tableNumber} sipariş durumu: ${status}`,
    });

    return NextResponse.json({
      message: "Sipariş durumu güncellendi",
      order: updatedOrder,
    });
  } catch (error) {
    console.error("Sipariş güncelleme hatası:", error);
    return NextResponse.json(
      { error: "Sipariş güncellenirken bir hata oluştu" },
      { status: 500 }
    );
  }
}
