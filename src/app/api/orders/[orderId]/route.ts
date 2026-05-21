import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { OrderStatus, TableStatus } from "@prisma/client";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
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

    // Masa durumunu sipariş durumuna göre güncelle
    let tableStatus: TableStatus = TableStatus.OCCUPIED;
    
    switch (status) {
      case OrderStatus.PENDING:
        tableStatus = TableStatus.HAS_ORDER;
        break;
      case OrderStatus.ACCEPTED:
        tableStatus = TableStatus.HAS_ORDER;
        break;
      case OrderStatus.PREPARING:
        tableStatus = TableStatus.PREPARING;
        break;
      case OrderStatus.SERVED:
        tableStatus = TableStatus.SERVED;
        break;
      case OrderStatus.CANCELLED:
        tableStatus = TableStatus.OCCUPIED;
        break;
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
  { params }: { params: { orderId: string } }
) {
  try {
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

    // Masa durumunu güncelle
    await prisma.table.update({
      where: { id: order.tableId },
      data: { status: TableStatus.OCCUPIED },
    });

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
