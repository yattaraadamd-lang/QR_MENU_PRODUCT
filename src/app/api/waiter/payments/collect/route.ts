import { NextRequest, NextResponse } from "next/server";
import { requireWaiterOrAdmin, getBusinessId } from "@/lib/auth-helpers";
import { emitToBusinessRoom } from "@/lib/socket-server";
import { processAdminPayment, PaymentError } from "@/lib/services/table-flow.service";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// POST /api/waiter/payments/collect — Ödeme al (admin + garson)
// WAITER: Yalnız PENDING ödeme talebi oluşturur — finansal kapanış yapamaz.
// ADMIN: processAdminPayment üzerinden tam ödeme alır.
export async function POST(request: NextRequest) {
  try {
    const { error, response, session } = await requireWaiterOrAdmin();
    if (error) return response!;
    const businessId = getBusinessId(session);
    const body = await request.json();
    const { tableSessionId, amount, method, note, receivedAmount } = body;

    if (!tableSessionId || !amount || !method) {
      return NextResponse.json({ error: "tableSessionId, amount ve method gerekli" }, { status: 400 });
    }

    if (typeof amount !== "number" || amount <= 0) {
      return NextResponse.json({ error: "Geçersiz tutar" }, { status: 400 });
    }

    const userRole = session!.user.role;

    // ── GARSON: Finansal kapanış yapamaz ─────────────────────────────────
    if (userRole === "WAITER") {
      // Garson yalnızca bilgi niteliğinde PENDING ödeme kaydı oluşturur.
      // Bu kayıt admin onayına sunulur.
      const tableSession = await prisma.tableSession.findFirst({
        where: { id: tableSessionId, businessId, status: "ACTIVE" },
        include: { bill: true, table: true },
      });

      if (!tableSession) {
        return NextResponse.json({ error: "Aktif oturum bulunamadı" }, { status: 404 });
      }

      if (!tableSession.bill) {
        return NextResponse.json({ error: "Adisyon bulunamadı" }, { status: 404 });
      }

      // Zaten bekleyen ödeme talebi var mı?
      const existingPending = await prisma.payment.findFirst({
        where: { tableSessionId, businessId, status: "PENDING" },
      });

      if (existingPending) {
        return NextResponse.json({
          error: "Bu masa için zaten bekleyen bir ödeme talebi var.",
          existingPayment: { id: existingPending.id },
        }, { status: 409 });
      }

      const payment = await prisma.payment.create({
        data: {
          businessId,
          tableId: tableSession.tableId,
          tableSessionId,
          billId: tableSession.bill.id,
          amount,
          method: method as any,
          note: note || null,
          status: "PENDING",
          handledById: session!.user.id,
          handledByWaiterName: session!.user.name,
        },
      });

      // Socket bildirimi
      try {
        emitToBusinessRoom(businessId, "payment_request", {
          tableNumber: tableSession.table.tableNumber,
          tableName: tableSession.table.tableName,
          amount,
          method,
          waiterName: session!.user.name,
        });
      } catch { /* socket opsiyonel */ }

      return NextResponse.json({
        message: "Ödeme talebi admin onayına gönderildi.",
        payment,
      }, { status: 201 });
    }

    // ── ADMIN: processAdminPayment ile tam ödeme ────────────────────────
    // tableSessionId üzerinden bill bul
    const tableSession = await prisma.tableSession.findFirst({
      where: { id: tableSessionId, businessId, status: "ACTIVE" },
      include: { bill: true },
    });

    if (!tableSession?.bill) {
      return NextResponse.json({ error: "Aktif oturum veya adisyon bulunamadı" }, { status: 404 });
    }

    const result = await processAdminPayment({
      billId: tableSession.bill.id,
      amount,
      method: method === "CREDIT_CARD" ? "CARD" : method,
      receivedAmount: receivedAmount || null,
      note: note || null,
      adminId: session!.user.id,
      adminName: session!.user.name,
      businessId,
    });

    // Socket bildirimi — transaction sonrası
    try {
      emitToBusinessRoom(businessId, "payment_collected", {
        tableNumber: result.table.tableNumber,
        tableName: result.table.tableName,
        amount,
        method,
        remainingAmount: Number(result.bill.remainingAmount),
        paymentStatus: result.bill.paymentStatus,
      });
    } catch { /* socket opsiyonel */ }

    return NextResponse.json({ payment: result.payment, bill: result.bill }, { status: 201 });
  } catch (e: any) {
    console.error("Ödeme alma hatası:", e);

    if (e instanceof PaymentError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.statusCode });
    }

    if (e.message?.includes("bulunamadı")) {
      return NextResponse.json({ error: e.message }, { status: 404 });
    }

    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
