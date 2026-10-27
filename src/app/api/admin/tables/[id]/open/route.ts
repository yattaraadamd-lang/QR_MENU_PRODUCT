import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, getBusinessIdFromSession } from "@/lib/tenant";
import { TableStatus } from "@prisma/client";
import { openTable } from "@/lib/services/table-flow.service";
import { withApiHandler } from "@/lib/api/handler";

// POST /api/admin/tables/[id]/open - Masayı aç (TableSession + Bill oluştur)
export const POST = withApiHandler("POST /api/admin/tables/[id]/open", handlePost);

async function handlePost(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  
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

  // ✅ TableSession + Bill + Table.status tek transaction'da; aktif oturum varsa (eşzamanlı
  // açılışta kazananınki dahil) yenisi oluşturulmaz
  const { tableSession, isNew } = await openTable(params.id, businessId);

  if (!isNew) {
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

  console.log(
    `[OPEN TABLE] tableId=${params.id} sessionId=${tableSession.id} businessId=${businessId}`
  );

  return NextResponse.json({
    message: "Masa başarıyla açıldı",
    table: {
      id: table.id,
      tableNumber: table.tableNumber,
      tableName: table.tableName,
      status: TableStatus.OCCUPIED,
    },
    tableSessionId: tableSession.id,
  });
}
