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

    // ✅ Validation
    if (!tableSessionId || !amount || !method) {
      return NextResponse.json(
        { error: "tableSessionId, amount ve method gerekli", code: "MISSING_REQUIRED_FIELDS" },
        { status: 400 }
      );
    }

    const normalizedAmount = Number(amount);
    const normalizedReceivedAmount = method === "CASH" ? Number(receivedAmount) : null;

    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      return NextResponse.json(
        { error: "Geçersiz ödeme tutarı", code: "INVALID_PAYMENT_AMOUNT" },
        { status: 400 }
      );
    }

    // ✅ CASH validation
    if (method === "CASH") {
      if (!Number.isFinite(normalizedReceivedAmount) || normalizedReceivedAmount! <= 0) {
        return NextResponse.json(
          {
            error: "Nakit ödeme için müşteriden alınan tutar belirtilmelidir.",
            code: "CASH_RECEIVED_AMOUNT_REQUIRED",
          },
          { status: 400 }
        );
      }
      if (normalizedReceivedAmount! < normalizedAmount) {
        return NextResponse.json(
          {
            error: `Alınan nakit (₺${normalizedReceivedAmount!.toFixed(2)}) ödeme tutarından (₺${normalizedAmount.toFixed(2)}) az olamaz.`,
            code: "CASH_AMOUNT_INSUFFICIENT",
          },
          { status: 400 }
        );
      }
    }

    // ADMIN: createDirectAdminPayment ile açık adisyondan ödeme al
    const prisma = (await import("@/lib/prisma")).prisma;
    const tableSession = await prisma.tableSession.findFirst({
      where: { id: tableSessionId, businessId, status: "ACTIVE" },
      include: { bill: true },
    });

    if (!tableSession?.bill) {
      return NextResponse.json(
        { error: "Aktif oturum veya adisyon bulunamadı", code: "TABLE_SESSION_NOT_ACTIVE" },
        { status: 404 }
      );
    }

    const result = await createDirectAdminPayment({
      billId: tableSession.bill.id,
      amount: normalizedAmount,
      method: method === "CREDIT_CARD" ? "CARD" : method,
      receivedAmount: normalizedReceivedAmount, // ✅ Pass receivedAmount
      note: note || null,
      adminId: session!.user.id,
      adminName: session!.user.name || "Admin",
      businessId,
    });

    try {
      emitToBusinessRoom(businessId, "payment_collected", {
        tableNumber: result.table.tableNumber,
        tableName: result.table.tableName,
        amount: normalizedAmount,
        method,
        receivedAmount: normalizedReceivedAmount,
        changeAmount: result.changeAmount,
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

    return NextResponse.json({ payment: result.payment, bill: result.bill, changeAmount: result.changeAmount }, { status: 201 });
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
