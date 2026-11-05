import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWaiterOrAdmin, getBusinessId } from "@/lib/auth-helpers";
import { TableStatus } from "@prisma/client";
import { writeTableStatus } from "@/lib/services/table-events.service";
import { withApiHandler, parseJson } from "@/lib/api/handler";
import { waiterTableStatusSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// Garson ekranı bu alanları kullanır (components/tables/types.ts). Liste açıkça yazılır: masanın
// QR token'ı ve talebin doğrulama kodu garsona dönmemeli, kod müşteriden sorulur.
const TABLE_SELECT = { id: true, tableNumber: true, tableName: true, status: true } as const;

// GET /api/waiter/tables — Masaları adisyon bilgisiyle getir
export async function GET(request: NextRequest) {
  try {
    const { error, response, session } = await requireWaiterOrAdmin();
    if (error) return response!;
    const businessId = getBusinessId(session);

    const tables = await prisma.table.findMany({
      where: { businessId, isDeleted: false },
      orderBy: { tableNumber: "asc" },
      select: {
        ...TABLE_SELECT,
        orders: {
          where: { status: { in: ["PENDING", "ACCEPTED", "PREPARING"] } },
          orderBy: { createdAt: "desc" },
          select: { id: true, status: true },
        },
        serviceRequests: {
          where: { status: { in: ["PENDING", "SEEN", "IN_PROGRESS"] } },
          orderBy: { createdAt: "desc" },
          select: { id: true, status: true, requestType: true },
        },
        tableSessions: {
          where: { status: "ACTIVE" },
          take: 1,
          select: {
            id: true,
            startedAt: true,
            bill: {
              select: { id: true, totalAmount: true, paidAmount: true, remainingAmount: true, paymentStatus: true },
            },
          },
        },
      },
    });

    // Her masaya aktif oturum ve adisyon bilgisini ekle
    const enriched = tables.map(({ tableSessions, ...t }) => {
      const active = tableSessions[0];
      return {
        ...t,
        activeSession: active ? { id: active.id, startedAt: active.startedAt } : null,
        bill: active?.bill ?? null,
      };
    });

    return NextResponse.json({ tables: enriched });
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
