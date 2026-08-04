import { NextRequest, NextResponse } from "next/server";
import { requireWaiterOrAdmin, getBusinessId } from "@/lib/auth-helpers";
import { emitToBusinessRoom } from "@/lib/socket-server";
import { createDirectAdminPayment, PaymentError } from "@/lib/services/payment.service";

export const dynamic = "force-dynamic";

// POST /api/waiter/payments/collect — Ödeme al (sadece admin doğrudan tahsil edebilir, garson 403)
export async function POST(request: NextRequest) {
  let userRole: string | undefined;

  try {
    const { error, response, session } = await requireWaiterOrAdmin();
    if (error) return response!;

    userRole = session?.user?.role;
    const businessId = getBusinessId(session);
    const body = await request.json();
    const { tableSessionId, amount, method, note, receivedAmount } = body;

    if (userRole === "WAITER") {
      return NextResponse.json(
        {
          error: "Garsonlar doğrudan ödeme tahsil edemez. Lütfen masanın ödeme talebini admin onayına gönderin.",
          code: "WAITER_DIRECT_PAYMENT_FORBIDDEN",
        },
        { status: 403 }
      );
    }

    if (!tableSessionId || !amount || !method) {
      return NextResponse.json({ error: "tableSessionId, amount ve method gerekli" }, { status: 400 });
    }

    if (typeof amount !== "number" || amount <= 0) {
      return NextResponse.json({ error: "Geçersiz tutar" }, { status: 400 });
    }

    // ADMIN: createDirectAdminPayment ile açık adisyondan ödeme al
    const prisma = (await import("@/lib/prisma")).prisma;
    const tableSession = await prisma.tableSession.findFirst({
      where: { id: tableSessionId, businessId, status: "ACTIVE" },
      include: { bill: true },
    });

    if (!tableSession?.bill) {
      return NextResponse.json({ error: "Aktif oturum veya adisyon bulunamadı" }, { status: 404 });
    }

    const result = await createDirectAdminPayment({
      billId: tableSession.bill.id,
      amount,
      method: method === "CREDIT_CARD" ? "CARD" : method,
      receivedAmount: receivedAmount || null,
      note: note || null,
      adminId: session!.user.id,
      adminName: session!.user.name || "Admin",
      businessId,
    });

    try {
      emitToBusinessRoom(businessId, "payment_collected", {
        tableNumber: result.table.tableNumber,
        tableName: result.table.tableName,
        amount,
        method,
        remainingAmount: Number(result.bill.remainingAmount),
        paymentStatus: result.bill.paymentStatus,
      });

      if (result.isFullyPaid) {
        emitToBusinessRoom(businessId, "table_status_update", {
          tableId: result.table.id,
          status: "EMPTY",
          message: `${result.table.tableName || "Masa " + result.table.tableNumber} hesabı ödendi.`,
        });
      }
    } catch { /* socket opsiyonel */ }

    return NextResponse.json({ payment: result.payment, bill: result.bill }, { status: 201 });
  } catch (e: any) {
    console.error("[PAYMENT_COLLECT_FAILED]", {
      endpoint: "/api/waiter/payments/collect",
      code: e?.code,
      name: e?.name,
      message: e?.message,
      userRole,
    });

    if (e instanceof PaymentError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.statusCode });
    }

    return NextResponse.json(
      { error: "Ödeme işlenirken bir hata oluştu.", code: "PAYMENT_INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
