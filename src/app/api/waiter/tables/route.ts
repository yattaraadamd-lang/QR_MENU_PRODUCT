import { NextRequest, NextResponse } from "next/server";
import type { TableListResponse } from "@/contracts/tables";
import { prisma } from "@/lib/prisma";
import { requireWaiterOrAdmin, getBusinessId } from "@/lib/auth-helpers";
import { TableStatus } from "@prisma/client";
import { writeTableStatus } from "@/lib/services/table-events.service";
import { withApiHandler, parseJson } from "@/lib/api/handler";
import { TABLE_LIST_SELECT, toTableDTO } from "@/lib/api/tables.dto";
import { waiterTableStatusSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// PUT yanıtındaki masa özeti. Alanlar açıkça yazılır: masanın QR token'ı garsona dönmez.
const TABLE_SELECT = { id: true, tableNumber: true, tableName: true, status: true } as const;

// GET /api/waiter/tables — Masaları adisyon bilgisiyle getir (sözleşme: src/contracts/tables.ts)
export async function GET(request: NextRequest) {
  try {
    const { error, response, session } = await requireWaiterOrAdmin();
    if (error) return response!;
    const businessId = getBusinessId(session);

    const tables = await prisma.table.findMany({
      where: { businessId, isDeleted: false },
      orderBy: { tableNumber: "asc" },
      select: TABLE_LIST_SELECT,
    });

    return NextResponse.json({ tables: tables.map(toTableDTO) } satisfies TableListResponse);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Masalar yüklenirken hata oluştu" }, { status: 500 });
  }
}

// PUT /api/waiter/tables — Masa durumu güncelle
export const PUT = withApiHandler("PUT /api/waiter/tables", handlePut);

async function handlePut(request: NextRequest) {
  const { error, response, session } = await requireWaiterOrAdmin();
  if (error) return response!;
  const businessId = getBusinessId(session);
  const { tableId, status } = await parseJson(request, waiterTableStatusSchema);

  if (!tableId || !status) return NextResponse.json({ error: "tableId ve status gerekli" }, { status: 400 });
  if (!["EMPTY", "CLEANING_NEEDED"].includes(status)) {
    return NextResponse.json({ error: "Garsonlar masayı sadece boş veya temizlenmesi gerekiyor olarak işaretleyebilir" }, { status: 400 });
  }

  const table = await prisma.table.findFirst({ where: { id: tableId, businessId } });
  if (!table) return NextResponse.json({ error: "Masa bulunamadı" }, { status: 404 });

  const updated = await prisma.$transaction(async (tx) => {
    await writeTableStatus(tx, { businessId, tableId }, status as TableStatus, {
      source: "STAFF",
      reason: "MANUAL_STATUS",
      actorUserId: session.user.id,
    });
    return tx.table.findUniqueOrThrow({ where: { id: tableId }, select: TABLE_SELECT });
  });
  return NextResponse.json({ message: "Masa durumu güncellendi", table: updated });
}
