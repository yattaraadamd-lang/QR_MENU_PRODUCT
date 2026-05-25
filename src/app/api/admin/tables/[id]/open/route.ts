import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, getBusinessIdFromSession } from "@/lib/tenant";
import { TableStatus } from "@prisma/client";

// POST /api/admin/tables/[id]/open - Masayı aç (müşteri kabul etmeye hazır)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // ✅ Authentication (Admin or Waiter)
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

    // ✅ Verify table ownership
    const table = await prisma.table.findFirst({
      where: { id: params.id, businessId, isActive: true, isDeleted: false },
    });

    if (!table) {
      return NextResponse.json(
        { error: "Masa bulunamadı" },
        { status: 404 }
      );
    }

    // ✅ Masa zaten açıksa hata verme
    const allowedStatuses: TableStatus[] = ["OCCUPIED", "HAS_ORDER", "PREPARING", "SERVED", "WAITING_WAITER", "PAYMENT_REQUESTED"];
    if (allowedStatuses.includes(table.status)) {
      return NextResponse.json(
        { 
          message: "Masa zaten açık",
          table: {
            id: table.id,
            tableNumber: table.tableNumber,
            tableName: table.tableName,
            status: table.status,
          }
        },
        { status: 200 }
      );
    }

    // ✅ Masayı OCCUPIED yap
    const updatedTable = await prisma.table.update({
      where: { id: params.id },
      data: { status: TableStatus.OCCUPIED },
      select: {
        id: true,
        tableNumber: true,
        tableName: true,
        status: true,
      },
    });

    return NextResponse.json({
      message: "Masa başarıyla açıldı",
      table: updatedTable,
    });
  } catch (error) {
    console.error("Masa açma hatası:", error);
    return NextResponse.json(
      { error: "Masa açılırken bir hata oluştu" },
      { status: 500 }
    );
  }
}
