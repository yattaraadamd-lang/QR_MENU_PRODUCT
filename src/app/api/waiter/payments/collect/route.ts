import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWaiterOrAdmin, getBusinessId } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

// POST /api/waiter/payments/collect — Ödeme al (admin + garson)
export async function POST(request: NextRequest) {
  try {
    const { error, response, session } = await requireWaiterOrAdmin();
    if (error) return response!;
    const businessId = getBusinessId(session);
    const body = await request.json();
    const { tableSessionId, amount, method, note } = body;

    if (!tableSessionId || !amount || !method) {
      return NextResponse.json({ error: "tableSessionId, amount ve method gerekli" }, { status: 400 });
    }

    // Oturum ve adisyon kontrolü
    const tableSession = await prisma.tableSession.findFirst({
      where: { id: tableSessionId, businessId, status: "ACTIVE" },
      include: { bill: true, table: true },
    });
    if (!tableSession) return NextResponse.json({ error: "Aktif oturum bulunamadı" }, { status: 404 });

    const bill = tableSession.bill;
    if (!bill) return NextResponse.json({ error: "Adisyon bulunamadı" }, { status: 404 });

    // Ödeme kaydı oluştur
    const payment = await prisma.payment.create({
      data: {
        businessId,
        tableId: tableSession.tableId,
        tableSessionId,
        billId: bill.id,
        amount,
        method,
        note: note || null,
        status: "PAID",
        paidAt: new Date(),
        handledById: session!.user.id,
        handledByWaiterName: session!.user.name,
      },
    });

    // Adisyonu yeniden hesapla
    const allPayments = await prisma.payment.findMany({
      where: { billId: bill.id, status: "PAID" },
    });
    const paidAmount = allPayments.reduce((s, p) => s + Number(p.amount), 0);
    const remainingAmount = Math.max(0, Number(bill.totalAmount) - paidAmount);

    let paymentStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID" = "UNPAID";
    if (remainingAmount === 0 && Number(bill.totalAmount) > 0) paymentStatus = "PAID";
    else if (paidAmount > 0) paymentStatus = "PARTIALLY_PAID";

    const updatedBill = await prisma.bill.update({
      where: { id: bill.id },
      data: { paidAmount, remainingAmount, paymentStatus },
    });

    // Socket.IO bildirimi
    try {
      const { emitToBusinessRoom } = require("@/lib/socket-server");
      emitToBusinessRoom(businessId, "payment_received", {
        tableNumber: tableSession.table.tableNumber,
        tableName: tableSession.table.tableName,
        amount,
        method,
        remainingAmount,
        paymentStatus,
      });
    } catch (e) { /* socket opsiyonel */ }

    return NextResponse.json({ payment, bill: updatedBill }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
