import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWaiterOrAdmin, requireAdmin, getBusinessId } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

// GET /api/bills/[sessionId] — Oturumun adisyonunu getir (admin + garson)
export async function GET(request: NextRequest, { params }: { params: { sessionId: string } }) {
  try {
    // Admin veya garson erişebilir
    const waiterCheck = await requireWaiterOrAdmin();
    if (waiterCheck.error) return waiterCheck.response!;
    const businessId = getBusinessId(waiterCheck.session);

    const bill = await prisma.bill.findFirst({
      where: { tableSessionId: params.sessionId, businessId },
      include: {
        tableSession: {
          include: {
            orders: {
              where: { status: { not: "CANCELLED" } },
              include: { items: { include: { product: true } }, waiter: { select: { name: true } } },
              orderBy: { createdAt: "asc" },
            },
          },
        },
        payments: {
          where: { status: "PAID" },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!bill) return NextResponse.json({ error: "Adisyon bulunamadı" }, { status: 404 });
    return NextResponse.json({ bill });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

// POST /api/bills/[sessionId]/recalculate — Adisyonu yeniden hesapla
export async function POST(request: NextRequest, { params }: { params: { sessionId: string } }) {
  try {
    const { error, response, session } = await requireWaiterOrAdmin();
    if (error) return response!;
    const businessId = getBusinessId(session);

    const bill = await prisma.bill.findFirst({
      where: { tableSessionId: params.sessionId, businessId },
    });
    if (!bill) return NextResponse.json({ error: "Adisyon bulunamadı" }, { status: 404 });

    // Tüm iptal edilmemiş siparişlerin toplamı
    const orders = await prisma.order.findMany({
      where: { tableSessionId: params.sessionId, status: { not: "CANCELLED" } },
    });
    const totalAmount = orders.reduce((s, o) => s + Number(o.totalPrice), 0);

    // Tamamlanan ödemelerin toplamı
    const payments = await prisma.payment.findMany({
      where: { billId: bill.id, status: "PAID" },
    });
    const paidAmount = payments.reduce((s, p) => s + Number(p.amount), 0);
    const remainingAmount = Math.max(0, totalAmount - paidAmount);

    let paymentStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID" = "UNPAID";
    if (remainingAmount === 0 && totalAmount > 0) paymentStatus = "PAID";
    else if (paidAmount > 0) paymentStatus = "PARTIALLY_PAID";

    const updated = await prisma.bill.update({
      where: { id: bill.id },
      data: { totalAmount, paidAmount, remainingAmount, paymentStatus },
    });

    return NextResponse.json({ bill: updated });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
