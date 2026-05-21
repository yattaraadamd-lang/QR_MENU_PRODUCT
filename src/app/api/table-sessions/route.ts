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

// POST /api/table-sessions — Yeni oturum başlat (müşteri QR okutunca)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { businessId, tableId } = body;
    if (!businessId || !tableId) return NextResponse.json({ error: "businessId ve tableId gerekli" }, { status: 400 });

    // Masa var mı ve aktif mi?
    const table = await prisma.table.findFirst({
      where: { id: tableId, businessId, isActive: true, isDeleted: false },
    });
    if (!table) return NextResponse.json({ error: "Masa bulunamadı" }, { status: 404 });

    // Zaten aktif oturum var mı?
    const existing = await prisma.tableSession.findFirst({
      where: { tableId, businessId, status: "ACTIVE" },
      include: { bill: true },
    });
    if (existing) return NextResponse.json({ tableSession: existing, isNew: false });

    // Yeni oturum + adisyon oluştur
    const tableSession = await prisma.tableSession.create({
      data: {
        businessId,
        tableId,
        status: "ACTIVE",
      },
    });

    const bill = await prisma.bill.create({
      data: {
        businessId,
        tableId,
        tableSessionId: tableSession.id,
        totalAmount: 0,
        paidAmount: 0,
        remainingAmount: 0,
        paymentStatus: "UNPAID",
        status: "OPEN",
      },
    });

    // Masa durumunu OCCUPIED yap
    await prisma.table.update({
      where: { id: tableId },
      data: { status: "OCCUPIED" },
    });

    return NextResponse.json({ tableSession: { ...tableSession, bill }, isNew: true }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
