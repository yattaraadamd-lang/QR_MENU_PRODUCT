import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, getBusinessIdFromSession } from "@/lib/tenant";
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
    // Frontend 'cancelReason' veya 'cancellationReason' gönderebilir — ikisini de destekle
    const rawBody = await request.json();
    const normalizedBody = {
      ...rawBody,
      cancellationReason:
        rawBody.cancellationReason ?? rawBody.cancelReason ?? null,
    };

    const validation = validateBody(updateOrderStatusSchema, normalizedBody);
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

    // ✅ Zaten tamamlanmış veya iptal edilmiş sipariş tekrar değiştirilemez
    if (["SERVED", "CANCELLED", "REJECTED"].includes(order.status)) {
      return NextResponse.json(
        {
          error: `Bu sipariş zaten "${order.status}" durumunda. Değiştirilemez.`,
        },
        { status: 409 }
      );
    }

    // ✅ PENDING -> ACCEPTED: TableSession ve Bill oluştur
    if (order.status === "PENDING" && status === "ACCEPTED") {
      let tableSession = await prisma.tableSession.findFirst({
        where: { tableId: order.tableId, businessId, status: "ACTIVE" },
        include: { bill: true },
      });

      if (!tableSession) {
        tableSession = await prisma.tableSession.create({
          data: {
            businessId,
            tableId: order.tableId,
            status: "ACTIVE",
          },
          include: { bill: true },
        });

        await prisma.bill.create({
          data: {
            businessId,
            tableId: order.tableId,
            tableSessionId: tableSession.id,
            totalAmount: 0,
            paidAmount: 0,
            remainingAmount: 0,
            paymentStatus: "UNPAID",
            status: "OPEN",
          },
        });

        tableSession = await prisma.tableSession.findFirst({
          where: { id: tableSession.id },
          include: { bill: true },
        });
      }

      if (tableSession) {
        await prisma.order.update({
          where: { id: params.id },
          data: { tableSessionId: tableSession.id },
        });

        if (tableSession.bill) {
          const newTotal =
            Number(tableSession.bill.totalAmount) + Number(order.totalPrice);
          const remaining = Math.max(
            0,
            newTotal - Number(tableSession.bill.paidAmount)
          );

          await prisma.bill.update({
            where: { id: tableSession.bill.id },
            data: {
              totalAmount: newTotal,
              remainingAmount: remaining,
            },
          });
        }
      }
    }

    // ✅ Build update data
    const updateData: any = {
      status,
      waiterId: authResult.session.userId,
    };

    // ✅ İptal veya red durumunda bilgileri kaydet
    if (status === "CANCELLED" || status === "REJECTED") {
      updateData.cancelledAt = new Date();
      updateData.cancelReason =
        cancellationReason ||
        (status === "REJECTED"
          ? "Garson tarafından reddedildi"
          : "Garson tarafından iptal edildi");
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

    // ✅ Diğer aktif siparişleri kontrol et
    const otherActiveOrders = await prisma.order.count({
      where: {
        tableId: order.tableId,
        id: { not: params.id },
        status: { in: ["PENDING", "ACCEPTED", "PREPARING"] },
      },
    });

    let newTableStatus: TableStatus | null = null;

    if (status === "ACCEPTED") {
      // Garson kabul etti - masa siparişli olur
      newTableStatus = TableStatus.HAS_ORDER;
    } else if (status === "PREPARING") {
      newTableStatus = TableStatus.PREPARING;
    } else if (status === "SERVED") {
      if (otherActiveOrders === 0) {
        newTableStatus = TableStatus.SERVED;
      }
    } else if (status === "CANCELLED" || status === "REJECTED") {
      // Garson iptal/reddetti - başka aktif sipariş yoksa masa boş kalır
      if (otherActiveOrders === 0) {
        newTableStatus = TableStatus.EMPTY;
      }
    }

    if (newTableStatus) {
      await prisma.table.update({
        where: { id: order.tableId },
        data: { status: newTableStatus },
      });
    }

    // ✅ İptal veya Red: adisyon tutarını güncelle
    if (
      (status === "CANCELLED" || status === "REJECTED") &&
      order.tableSessionId
    ) {
      const bill = await prisma.bill.findFirst({
        where: { tableSessionId: order.tableSessionId },
        select: {
          id: true,
          totalAmount: true,
          paidAmount: true,
        },
      });

      if (bill) {
        const newTotal = Math.max(
          0,
          Number(bill.totalAmount) - Number(order.totalPrice)
        );
        const remaining = Math.max(0, newTotal - Number(bill.paidAmount));

        let paymentStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID" = "UNPAID";

        if (remaining === 0 && newTotal > 0) {
          paymentStatus = "PAID";
        } else if (Number(bill.paidAmount) > 0) {
          paymentStatus = "PARTIALLY_PAID";
        }

        await prisma.bill.update({
          where: { id: bill.id },
          data: {
            totalAmount: newTotal,
            remainingAmount: remaining,
            paymentStatus,
          },
        });
      }
    }

    // ✅ Socket.IO notification
    try {
      emitToBusinessRoom(businessId, "order_status_update", {
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
  } catch (error) {
    console.error("Sipariş güncelleme hatası:", error);

    return NextResponse.json(
      { error: "Sipariş güncellenirken bir hata oluştu" },
      { status: 500 }
    );
  }
}