import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, getBusinessId } from "@/lib/auth-helpers";
import { OrderStatus } from "@prisma/client";
import { emitToBusinessRoom } from "@/lib/socket-server";
import { tableStatusAfterOrderRemoved } from "@/lib/table-session";

// PUT /api/admin/orders/[orderId]/cancel - Admin sipariş iptal
export async function PUT(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const { error, response, session } = await requireAdmin();
    if (error) return response!;

    const businessId = getBusinessId(session);
    const body = await request.json();
    const { cancelReason } = body;

    const order = await prisma.order.findFirst({
      where: { id: params.orderId, businessId },
      include: { table: true },
    });

    if (!order) {
      return NextResponse.json(
        { error: "Sipariş bulunamadı" },
        { status: 404 }
      );
    }

    if (order.status === "CANCELLED" || order.status === "SERVED") {
      return NextResponse.json(
        { error: "Bu sipariş zaten tamamlanmış veya iptal edilmiş" },
        { status: 400 }
      );
    }

    // Siparişi iptal et
    const updatedOrder = await prisma.order.update({
      where: { id: params.orderId },
      data: {
        status: OrderStatus.CANCELLED,
        cancelReason: cancelReason || "Admin tarafından iptal edildi",
        cancelledAt: new Date(),
      },
      include: {
        items: { include: { product: true } },
        table: true,
      },
    });

    // ✅ Aktif oturum yoksa masa EMPTY kalır — iptal edilen sipariş masayı doldurmaz
    const newTableStatus = await tableStatusAfterOrderRemoved(prisma, businessId, order.tableId);
    await prisma.table.update({
      where: { id: order.tableId },
      data: { status: newTableStatus },
    });

    // Kabul edilmiş sipariş iptal edildiyse adisyondan düş
    if (order.tableSessionId && order.status !== "PENDING") {
      const bill = await prisma.bill.findUnique({ where: { tableSessionId: order.tableSessionId } });
      if (bill) {
        const newTotal = Math.max(0, Number(bill.totalAmount) - Number(order.totalPrice));
        await prisma.bill.update({
          where: { id: bill.id },
          data: { totalAmount: newTotal, remainingAmount: Math.max(0, newTotal - Number(bill.paidAmount)) },
        });
      }
    }

    // Socket.IO bildirimi
    emitToBusinessRoom(businessId, "order_cancelled", {
      orderId: order.id,
      tableNumber: order.table.tableNumber,
      tableName: order.table.tableName,
      message: `${order.table.tableName || "Masa " + order.table.tableNumber} siparişi iptal edildi`,
    });

    return NextResponse.json({
      message: "Sipariş iptal edildi",
      order: updatedOrder,
    });
  } catch (error) {
    console.error("Sipariş iptal hatası:", error);
    return NextResponse.json(
      { error: "Sipariş iptal edilirken bir hata oluştu" },
      { status: 500 }
    );
  }
}
