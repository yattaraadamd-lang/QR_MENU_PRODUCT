import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, getBusinessIdFromSession } from "@/lib/tenant";
import { TableStatus } from "@prisma/client";

// POST /api/admin/tables/[id]/open - Masayı aç (TableSession + Bill oluştur)
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

    // ✅ Zaten aktif TableSession var mı kontrol et
    const existingSession = await prisma.tableSession.findFirst({
      where: { tableId: params.id, businessId, status: "ACTIVE" },
      select: { id: true },
    });

    if (existingSession) {
      // Session zaten var — masa zaten açık, sadece status güncelle
      await prisma.table.update({
        where: { id: params.id },
        data: { status: TableStatus.OCCUPIED },
      });
      return NextResponse.json(
        {
          message: "Masa zaten açık",
          table: {
            id: table.id,
            tableNumber: table.tableNumber,
            tableName: table.tableName,
            status: "OCCUPIED",
          },
        },
        { status: 200 }
      );
    }

    // ✅ Transaction: TableSession + Bill + Table.status güncelle
    const result = await prisma.$transaction(async (tx) => {
      // 1. TableSession oluştur
      const tableSession = await tx.tableSession.create({
        data: {
          businessId,
          tableId: params.id,
          status: "ACTIVE",
        },
      });

      // 2. Bill (adisyon) oluştur
      await tx.bill.create({
        data: {
          businessId,
          tableId: params.id,
          tableSessionId: tableSession.id,
          totalAmount: 0,
          paidAmount: 0,
          remainingAmount: 0,
          paymentStatus: "UNPAID",
          status: "OPEN",
        },
      });

      // 3. Table durumunu OCCUPIED yap
      const updatedTable = await tx.table.update({
        where: { id: params.id },
        data: { status: TableStatus.OCCUPIED },
        select: {
          id: true,
          tableNumber: true,
          tableName: true,
          status: true,
        },
      });

      return { tableSession, updatedTable };
    });

    console.log(
      `[OPEN TABLE] tableId=${params.id} sessionId=${result.tableSession.id} businessId=${businessId}`
    );

    return NextResponse.json({
      message: "Masa başarıyla açıldı",
      table: result.updatedTable,
      tableSessionId: result.tableSession.id,
    });
  } catch (error) {
    console.error("Masa açma hatası:", error);
    return NextResponse.json(
      { error: "Masa açılırken bir hata oluştu" },
      { status: 500 }
    );
  }
}
