import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/admin/tables/[id]/force-close
 * Admin masayı zorla kapatır (aktif sipariş varsa bile)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    // Sadece ADMIN kullanabilir
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Bu işlem için admin yetkisi gereklidir" },
        { status: 403 }
      );
    }

    const tableId = params.id;
    const body = await req.json().catch(() => ({}));
    const closeReason = body.closeReason || "Admin tarafından zorla kapatıldı";

    // Transaction içinde tüm işlemleri yap
    const result = await prisma.$transaction(async (tx) => {
      // 1. Masayı bul
      const table = await tx.table.findUnique({
        where: { id: tableId },
        include: {
          tableSessions: {
            where: { status: "ACTIVE" },
            take: 1,
            include: {
              orders: {
                where: {
                  status: {
                    in: ["PENDING", "ACCEPTED", "PREPARING", "SERVED"],
                  },
                },
              },
              bill: true,
            },
          },
        },
      });

      if (!table) {
        throw new Error("Masa bulunamadı");
      }

      const activeSession = table.tableSessions[0];
      if (!activeSession) {
        throw new Error("Bu masada aktif oturum yok");
      }

      // 2. Aktif siparişleri iptal et
      if (activeSession.orders.length > 0) {
        await tx.order.updateMany({
          where: {
            tableSessionId: activeSession.id,
            status: {
              in: ["PENDING", "ACCEPTED", "PREPARING", "SERVED"],
            },
          },
          data: {
            status: "CANCELLED",
            cancelReason: closeReason,
          },
        });
      }

      // 3. Açık bill'i kapat veya iptal et
      if (activeSession.bill) {
        const billStatus =
          Number(activeSession.bill.paidAmount) > 0 ? "CLOSED" : "CANCELLED";
        await tx.bill.update({
          where: { id: activeSession.bill.id },
          data: {
            status: billStatus,
            closedAt: new Date(),
          },
        });
      }

      // 4. Aktif CustomerSession kayıtlarını kapat
      await tx.customerSession.updateMany({
        where: {
          tableId: tableId,
          status: "ACTIVE",
        },
        data: {
          status: "CLOSED",
        },
      });

      // 5. TableSession'ı kapat
      await tx.tableSession.update({
        where: { id: activeSession.id },
        data: {
          status: "CLOSED",
          endedAt: new Date(),
        },
      });

      // 6. Table durumunu EMPTY yap
      await tx.table.update({
        where: { id: tableId },
        data: {
          status: "EMPTY",
        },
      });

      return {
        tableId,
        cancelledOrders: activeSession.orders.length,
        closeReason,
      };
    });

    return NextResponse.json({
      success: true,
      message: "Masa admin tarafından zorla kapatıldı",
      ...result,
    });
  } catch (error: any) {
    console.error("Force close error:", error);
    return NextResponse.json(
      { error: error.message || "Masa zorla kapatılırken hata oluştu" },
      { status: 500 }
    );
  }
}
