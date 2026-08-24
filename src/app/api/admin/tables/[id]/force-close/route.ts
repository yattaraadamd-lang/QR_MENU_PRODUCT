import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getBusinessId } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { createAuditLog, AuditActions } from "@/lib/services/audit-log.service";

/**
 * POST /api/admin/tables/[id]/force-close
 * Admin masayı zorla kapatır (aktif sipariş varsa bile)
 * 🔒 P0-09 FIX: requireAdmin() + tenant-scoped table lookup
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    
    // ✅ P0-09 FIX: Use centralized auth guard with DB validation
    const { error, response, session } = await requireAdmin();
    if (error) return response!;

    const businessId = getBusinessId(session);
    const tableId = params.id;
    const body = await req.json().catch(() => ({}));
    const closeReason = body.closeReason || "Admin tarafından zorla kapatıldı";

    // Transaction içinde tüm işlemleri yap
    const result = await prisma.$transaction(async (tx) => {
      // 1. ✅ P0-09 FIX: Masayı tenant scope ile bul
      const table = await tx.table.findFirst({
        where: { id: tableId, businessId },
        include: {
          tableSessions: {
            where: { status: "ACTIVE" },
            take: 1,
            include: {
              orders: {
                where: {
                  // ✅ Sadece gerçekten işlemde olan siparişler iptal edilir
                  // SERVED = servis edildi, iptal edilmez
                  status: {
                    in: ["PENDING", "ACCEPTED", "PREPARING"],
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

      // 2. Gerçekten işlemde olan siparişleri iptal et (SERVED dokunulmaz)
      if (activeSession.orders.length > 0) {
        await tx.order.updateMany({
          where: {
            tableSessionId: activeSession.id,
            status: {
              in: ["PENDING", "ACCEPTED", "PREPARING"],
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

    createAuditLog({
      businessId,
      actorUserId: session.user.id,
      actorRole: "ADMIN",
      action: AuditActions.TABLE_FORCE_CLOSED,
      entityType: "Table",
      entityId: tableId,
      metadata: {
        closeReason,
        cancelledOrders: result.cancelledOrders,
      },
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
