import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, getBusinessIdFromSession } from "@/lib/tenant";
import { validateBody, updateOrderStatusSchema, isValidCuid } from "@/lib/validation";
import { OrderStatus, TableStatus } from "@prisma/client";
import { emitToBusinessRoom } from "@/lib/socket-server";
import { getOrCreateActiveTableSession, tableStatusAfterOrderRemoved } from "@/lib/table-session";

// PUT /api/waiter/orders/[id]/status - Sipariş durumu güncelle
// ✅ ACCEPTED: TableSession/Bill oluştur, masa HAS_ORDER yap
// ✅ REJECTED:  TableSession/Bill oluşturma, masa durumu değişmez
// ✅ CANCELLED: Adisyon tutarını düşür
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth();
    if (!authResult.success) return authResult.response;

    if (!["WAITER", "ADMIN", "SUPER_ADMIN"].includes(authResult.session.role)) {
      return NextResponse.json(
        { error: "Bu işlem için garson veya admin yetkisi gereklidir" },
        { status: 403 }
      );
    }

    const businessId = getBusinessIdFromSession(authResult.session);

    if (!isValidCuid(params.id)) {
      return NextResponse.json({ error: "Geçersiz sipariş ID formatı" }, { status: 400 });
    }

    const rawBody = await request.json();
    const normalizedBody = {
      ...rawBody,
      cancellationReason: rawBody.cancellationReason ?? rawBody.cancelReason ?? null,
    };
    const validation = validateBody(updateOrderStatusSchema, normalizedBody);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const status = validation.data.status as OrderStatus;
    const cancellationReason = validation.data.cancellationReason;

    const order = await prisma.order.findFirst({
      where: { id: params.id, businessId },
      select: {
        id: true,
        tableId: true,
        tableSessionId: true,
        totalPrice: true,
        status: true,
        table: {
          select: { id: true, tableNumber: true, tableName: true },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Sipariş bulunamadı" }, { status: 404 });
    }

    // Zaten tamamlanmış/reddedilmiş sipariş tekrar değiştirilemez
    if (["SERVED", "CANCELLED", "REJECTED"].includes(order.status)) {
      return NextResponse.json(
        { error: `Bu sipariş zaten "${order.status}" durumunda. Değiştirilemez.` },
        { status: 409 }
      );
    }

    // ─── KABUL: TableSession + Bill oluştur, masa HAS_ORDER yap ───────────────
    let tableSessionId = order.tableSessionId;

    if (status === "ACCEPTED") {
      // ✅ Aktif oturum yoksa oluşturulur (masa kilitli → tek ACTIVE oturum garantisi)
      tableSessionId = await prisma.$transaction(async (tx) => {
        const tableSession = await getOrCreateActiveTableSession(tx, businessId, order.tableId);

        if (tableSession.bill) {
          const newTotal = Number(tableSession.bill.totalAmount) + Number(order.totalPrice);
          const remaining = Math.max(0, newTotal - Number(tableSession.bill.paidAmount));
          await tx.bill.update({
            where: { id: tableSession.bill.id },
            data: { totalAmount: newTotal, remainingAmount: remaining },
          });
        }

        await tx.table.update({
          where: { id: order.tableId },
          data: { status: TableStatus.HAS_ORDER },
        });

        return tableSession.id;
      });
    }

    // ─── Güncelleme verisi ─────────────────────────────────────────────────────
    const updateData: any = {
      status,
      waiterId: authResult.session.userId,
      ...(tableSessionId !== order.tableSessionId ? { tableSessionId } : {}),
    };

    if (status === "CANCELLED" || status === "REJECTED") {
      updateData.cancelledAt = new Date();
      updateData.cancelReason = cancellationReason
        || (status === "REJECTED" ? "Garson tarafından reddedildi" : "Garson tarafından iptal edildi");
    }

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
        tableSessionId: true,
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
          select: { tableNumber: true, tableName: true },
        },
      },
    });

    // ─── Diğer statüsler için masa güncelleme ─────────────────────────────────
    let newTableStatus: TableStatus | null = null;

    if (status === "PREPARING") {
      newTableStatus = TableStatus.PREPARING;
    } else if (status === "SERVED") {
      const otherActive = await prisma.order.count({
        where: {
          tableId: order.tableId,
          id: { not: params.id },
          status: { in: ["PENDING", "ACCEPTED", "PREPARING"] },
        },
      });
      if (otherActive === 0) newTableStatus = TableStatus.SERVED;
    } else if (status === "CANCELLED" || status === "REJECTED") {
      // ✅ Aktif oturum yoksa masa EMPTY kalır — reddedilen sipariş masayı doldurmaz
      newTableStatus = await tableStatusAfterOrderRemoved(prisma, businessId, order.tableId);
    }

    if (newTableStatus && status !== "ACCEPTED") {
      await prisma.table.update({
        where: { id: order.tableId },
        data: { status: newTableStatus },
      });
    }

    // ─── İptal/Red — adisyon tutarını düşür ──────────────────────────────────
    if ((status === "CANCELLED" || status === "REJECTED") && tableSessionId) {
      const bill = await prisma.bill.findFirst({
        where: { tableSessionId },
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

    // ─── Socket.IO bildirimi ──────────────────────────────────────────────────
    try {
      emitToBusinessRoom(businessId, "order_status_update", {
        orderId: order.id,
        tableNumber: order.table.tableNumber,
        tableName: order.table.tableName,
        status,
        tableStatus: newTableStatus,
        message: `${order.table.tableName || "Masa " + order.table.tableNumber} sipariş: ${status}`,
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
