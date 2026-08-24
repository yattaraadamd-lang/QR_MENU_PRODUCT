import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TableStatus } from "@prisma/client";
import { requireWaiterOrAdmin, getBusinessId } from "@/lib/auth-helpers";
import { openTable } from "@/lib/services/table-flow.service";

/**
 * 🔒 P0-09 FIX: Table Detail API — Auth + Tenant Isolation
 *
 * PREVIOUSLY: No authentication, businessId from request body.
 * Anyone could update any business's table status.
 *
 * NOW: requireWaiterOrAdmin(), businessId from session.
 * Ownership verified before mutation.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ tableId: string }> }
) {
  try {
    // ✅ P0-09 FIX: Require authentication
    const { error, response, session } = await requireWaiterOrAdmin();
    if (error) return response!;

    const businessId = getBusinessId(session);
    const params = await context.params;
    const { tableId } = params;
    const body = await request.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json(
        { error: "Durum bilgisi gerekli" },
        { status: 400 }
      );
    }

    // ✅ P0-09 FIX: Verify table belongs to authenticated user's business
    const currentTable = await prisma.table.findFirst({
      where: { id: tableId, businessId },
      select: { id: true, status: true },
    });

    if (!currentTable) {
      return NextResponse.json({ error: "Masa bulunamadı" }, { status: 404 });
    }

    // ✅ "OCCUPIED" isteği gelirse → merkezi openTable kullan (session + bill oluşturulur)
    if (status === "OCCUPIED") {
      try {
        const result = await openTable(tableId, businessId);
        const table = await prisma.table.findUnique({ where: { id: tableId } });
        return NextResponse.json({
          message: "Masa açıldı",
          table,
          tableSession: result.tableSession,
          bill: result.bill,
          isNew: result.isNew,
        });
      } catch (e: any) {
        return NextResponse.json(
          { error: e.message || "Masa açılırken hata oluştu" },
          { status: 400 }
        );
      }
    }

    // ✅ Diğer durum güncellemeleri — geçiş kontrolü
    // Geçerli durum geçişleri
    const VALID_TRANSITIONS: Record<string, string[]> = {
      EMPTY:             ["OCCUPIED"],
      OCCUPIED:          ["HAS_ORDER", "WAITING_WAITER", "EMPTY"],
      HAS_ORDER:         ["PREPARING", "WAITING_WAITER", "PAYMENT_REQUESTED", "SERVED", "OCCUPIED"],
      PREPARING:         ["SERVED", "WAITING_WAITER", "PAYMENT_REQUESTED", "HAS_ORDER"],
      SERVED:            ["PAYMENT_REQUESTED", "WAITING_WAITER", "CLEANING_NEEDED", "EMPTY", "HAS_ORDER"],
      WAITING_WAITER:    ["OCCUPIED", "HAS_ORDER", "PREPARING", "SERVED", "PAYMENT_REQUESTED", "EMPTY"],
      PAYMENT_REQUESTED: ["SERVED", "CLEANING_NEEDED", "EMPTY", "WAITING_WAITER"],
      CLEANING_NEEDED:   ["EMPTY"],
    };

    const allowed = VALID_TRANSITIONS[currentTable.status] || [];
    if (currentTable.status !== status && !allowed.includes(status)) {
      return NextResponse.json(
        { error: `Geçersiz durum geçişi: ${currentTable.status} → ${status}` },
        { status: 400 }
      );
    }

    const table = await prisma.table.update({
      where: { id: tableId },
      data: { status },
    });

    return NextResponse.json({
      message: "Masa durumu güncellendi",
      table,
    });
  } catch (error) {
    console.error("Masa güncelleme hatası:", error);
    return NextResponse.json(
      { error: "Masa güncellenirken bir hata oluştu" },
      { status: 500 }
    );
  }
}
