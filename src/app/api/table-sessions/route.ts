import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWaiterOrAdmin, getBusinessId } from "@/lib/auth-helpers";
import { openTable, getActiveTableSession } from "@/lib/services/table-flow.service";

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

// POST /api/table-sessions — Yeni oturum başlat (garson veya müşteri QR okutunca)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { businessId, tableId } = body;
    if (!businessId || !tableId) return NextResponse.json({ error: "businessId ve tableId gerekli" }, { status: 400 });

    // ✅ Merkezi table-flow.service kullanarak transaction ile masa aç
    const result = await openTable(tableId, businessId);

    return NextResponse.json(
      { tableSession: result.tableSession, bill: result.bill, isNew: result.isNew },
      { status: result.isNew ? 201 : 200 }
    );
  } catch (e: any) {
    console.error("Masa açma hatası:", e);
    if (e.message?.includes("bulunamadı") || e.message?.includes("aktif değil")) {
      return NextResponse.json({ error: e.message }, { status: 404 });
    }
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
