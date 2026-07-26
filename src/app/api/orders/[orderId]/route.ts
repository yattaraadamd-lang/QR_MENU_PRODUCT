import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { OrderStatus, TableStatus } from "@prisma/client";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const params = await context.params;
    const { orderId } = params;
    const body = await request.json();
    const { status, waiterId, cancelReason } = body;

    if (!status) {
      return NextResponse.json(
        { error: "Durum bilgisi gerekli" },
        { status: 400 }
      );
    }

    const updateData: any = { status };
    if (waiterId) {
      updateData.waiterId = waiterId;
    }

    // İptal durumu için ek alanlar
    if (status === OrderStatus.CANCELLED) {
      updateData.cancelReason = cancelReason || "Belirtilmedi";
      updateData.cancelledAt = new Date();
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

    // ✅ Masa durumunu TÜM siparişlere göre güncelle (sadece bu siparişe göre değil)
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
<<<<<<< HEAD
      } else {
        tableStatus = TableStatus.PREPARING;
      }
    } else if (status === OrderStatus.CANCELLED) {
      if (otherActiveOrders === 0) {
        // ✅ SERVED (ödenmemiş) siparişleri kontrol et
        const unpaidServedOrders = await prisma.order.count({
          where: {
            tableId: order.tableId,
            status: "SERVED",
            paymentStatus: "UNPAID",
          },
        });
        tableStatus = unpaidServedOrders > 0 ? TableStatus.SERVED : TableStatus.OCCUPIED;
      } else {
        // Diğer aktif siparişler var, masa durumunu değiştirme
        tableStatus = TableStatus.HAS_ORDER;
      }
=======
        break;
      case OrderStatus.CANCELLED:
        // ✅ İptal durumunda başka SERVED sipariş var mı kontrol et
        const servedOrders = await prisma.order.count({
          where: {
            tableId: order.tableId,
            id: { not: orderId },
            status: "SERVED",
          },
        });
        tableStatus = servedOrders > 0 ? TableStatus.SERVED : TableStatus.OCCUPIED;
        break;
>>>>>>> 1c180c9b6435330c9599466643bfd3610b268fc2
    }

    await prisma.table.update({
      where: { id: order.tableId },
      data: { status: tableStatus },
    });

    // Durum bildirimi oluştur
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
    } else if (status === OrderStatus.CANCELLED) {
      await prisma.notification.create({
        data: {
          businessId: order.businessId,
          tableId: order.tableId,
          type: "ORDER_STATUS_UPDATE",
          title: "Sipariş İptal Edildi",
          message: `Masa ${order.table.tableNumber} siparişi iptal edildi`,
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
    const { searchParams } = new URL(request.url);
    const cancelReason = searchParams.get("reason") || "Admin tarafından iptal edildi";

    const order = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.CANCELLED,
        cancelReason,
        cancelledAt: new Date(),
      },
      include: {
        table: true,
      },
    });

<<<<<<< HEAD
    // ✅ Masa durumunu güncelle — SERVED ödenmemiş sipariş varsa masa kapanmamalı
    const otherActiveOrders = await prisma.order.count({
      where: {
        tableId: order.tableId,
        id: { not: orderId },
        status: { in: ["PENDING", "ACCEPTED", "PREPARING"] },
      },
=======
    // ✅ İptal sonrası masa durumunu kontrol et
    const servedOrders = await prisma.order.count({
      where: {
        tableId: order.tableId,
        id: { not: orderId },
        status: "SERVED",
      },
    });

    // Masa durumunu güncelle
    const newTableStatus = servedOrders > 0 ? TableStatus.SERVED : TableStatus.OCCUPIED;
    
    await prisma.table.update({
      where: { id: order.tableId },
      data: { status: newTableStatus },
>>>>>>> 1c180c9b6435330c9599466643bfd3610b268fc2
    });

    if (otherActiveOrders === 0) {
      const unpaidServedOrders = await prisma.order.count({
        where: {
          tableId: order.tableId,
          status: "SERVED",
          paymentStatus: "UNPAID",
        },
      });

      await prisma.table.update({
        where: { id: order.tableId },
        data: { status: unpaidServedOrders > 0 ? TableStatus.SERVED : TableStatus.OCCUPIED },
      });
    }

    // Bildirim oluştur
    await prisma.notification.create({
      data: {
        businessId: order.businessId,
        tableId: order.tableId,
        type: "ORDER_STATUS_UPDATE",
        title: "Sipariş İptal Edildi",
        message: `Masa ${order.table.tableNumber} siparişi iptal edildi`,
        soundType: "DEFAULT",
      },
    });

    return NextResponse.json({
      message: "Sipariş iptal edildi",
      order,
    });
  } catch (error) {
    console.error("Sipariş iptal hatası:", error);
    return NextResponse.json(
      { error: "Sipariş iptal edilirken bir hata oluştu" },
      { status: 500 }
    );
  }
}
