import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWaiterOrAdmin, getBusinessId } from "@/lib/auth-helpers";
import { TableStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

// GET /api/waiter/tables — Masaları adisyon bilgisiyle getir
export async function GET(request: NextRequest) {
  try {
    const { error, response, session } = await requireWaiterOrAdmin();
    if (error) return response!;
    const businessId = getBusinessId(session);

    const tables = await prisma.table.findMany({
      where: { businessId, isDeleted: false },
      orderBy: { tableNumber: "asc" },
      include: {
        orders: {
          where: { status: { in: ["PENDING", "ACCEPTED", "PREPARING"] } },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        serviceRequests: {
          where: { status: { in: ["PENDING", "SEEN", "IN_PROGRESS"] } },
          orderBy: { createdAt: "desc" },
        },
        tableSessions: {
          where: { status: "ACTIVE" },
          take: 1,
          include: {
            bill: true,
          },
        },
      },
    });

    // Her masaya aktif oturum ve adisyon bilgisini ekle
    const enriched = tables.map(t => ({
      ...t,
      activeSession: t.tableSessions[0] || null,
      bill: t.tableSessions[0]?.bill || null,
    }));

    return NextResponse.json({ tables: enriched });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Masalar yüklenirken hata oluştu" }, { status: 500 });
  }
}

// PUT /api/waiter/tables — Masa durumu güncelle
export async function PUT(request: NextRequest) {
  try {
    const { error, response, session } = await requireWaiterOrAdmin();
    if (error) return response!;
    const businessId = getBusinessId(session);
    const body = await request.json();
    const { tableId, status } = body;

    if (!tableId || !status) return NextResponse.json({ error: "tableId ve status gerekli" }, { status: 400 });
    if (!["EMPTY", "CLEANING_NEEDED"].includes(status)) {
      return NextResponse.json({ error: "Garsonlar masayı sadece boş veya temizlenmesi gerekiyor olarak işaretleyebilir" }, { status: 400 });
    }

    const table = await prisma.table.findFirst({ where: { id: tableId, businessId } });
    if (!table) return NextResponse.json({ error: "Masa bulunamadı" }, { status: 404 });

    const updated = await prisma.table.update({ where: { id: tableId }, data: { status: status as TableStatus } });
    return NextResponse.json({ message: "Masa durumu güncellendi", table: updated });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Masa güncellenirken hata oluştu" }, { status: 500 });
  }
}
