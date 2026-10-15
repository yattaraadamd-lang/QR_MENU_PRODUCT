import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWaiterOrAdmin, getBusinessId } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

// GET /api/table-sessions?tableId=xxx — Aktif oturumu getir
export async function GET(request: NextRequest) {
  try {
    const { error, response, session } = await requireWaiterOrAdmin();
    if (error) return response!;
    const businessId = getBusinessId(session);
    const { searchParams } = new URL(request.url);
    const tableId = searchParams.get("tableId");

    if (!tableId) return NextResponse.json({ error: "tableId gerekli" }, { status: 400 });

    const tableSession = await prisma.tableSession.findFirst({
      where: { tableId, businessId, status: "ACTIVE" },
      include: {
        bill: true,
        orders: {
          where: { status: { not: "CANCELLED" } },
          include: { items: { include: { product: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    return NextResponse.json({ tableSession });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

// POST kaldırıldı: masa oturumu sadece garson siparişi kabul edince açılır (lib/table-session.ts).
