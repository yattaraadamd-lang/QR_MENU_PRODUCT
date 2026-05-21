import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWaiterOrAdmin, getBusinessId } from "@/lib/auth-helpers";
import { RequestStatus, TableStatus } from "@prisma/client";
import { emitToBusinessRoom } from "@/lib/socket-server";

// PUT /api/waiter/service-requests/[id]/status - Talep durumu güncelle
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { error, response, session } = await requireWaiterOrAdmin();
    if (error) return response!;

    const businessId = getBusinessId(session);
    const body = await request.json();
    const { status } = body;

    if (!status || !["SEEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"].includes(status)) {
      return NextResponse.json(
        { error: "Geçersiz talep durumu" },
        { status: 400 }
      );
    }

    const serviceRequest = await prisma.serviceRequest.findFirst({
      where: { id: params.id, businessId },
      include: { table: true },
    });

    if (!serviceRequest) {
      return NextResponse.json(
        { error: "Talep bulunamadı" },
        { status: 404 }
      );
    }

    const updatedRequest = await prisma.serviceRequest.update({
      where: { id: params.id },
      data: {
        status: status as RequestStatus,
        ...(status === "COMPLETED" && { completedAt: new Date() }),
      },
      include: { table: true },
    });

    // Talep tamamlandığında masa durumunu kontrol et
    if (status === "COMPLETED" || status === "CANCELLED") {
      // Aynı masada başka aktif talep var mı?
      const otherActiveRequests = await prisma.serviceRequest.count({
        where: {
          tableId: serviceRequest.tableId,
          id: { not: params.id },
          status: { in: ["PENDING", "SEEN", "IN_PROGRESS"] },
        },
      });

      // Aktif sipariş var mı?
      const activeOrders = await prisma.order.count({
        where: {
          tableId: serviceRequest.tableId,
          status: { in: ["PENDING", "ACCEPTED", "PREPARING"] },
        },
      });

      if (otherActiveRequests === 0) {
        let newStatus: TableStatus = TableStatus.OCCUPIED;
        if (activeOrders > 0) {
          newStatus = TableStatus.HAS_ORDER;
        }

        await prisma.table.update({
          where: { id: serviceRequest.tableId },
          data: { status: newStatus },
        });
      }
    }

    // Socket.IO bildirimi
    emitToBusinessRoom(businessId, "request_status_update", {
      requestId: serviceRequest.id,
      tableNumber: serviceRequest.table.tableNumber,
      tableName: serviceRequest.table.tableName,
      status,
      requestType: serviceRequest.requestType,
    });

    return NextResponse.json({
      message: "Talep durumu güncellendi",
      serviceRequest: updatedRequest,
    });
  } catch (error) {
    console.error("Talep güncelleme hatası:", error);
    return NextResponse.json(
      { error: "Talep güncellenirken bir hata oluştu" },
      { status: 500 }
    );
  }
}
