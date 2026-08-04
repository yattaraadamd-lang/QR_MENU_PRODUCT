import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createDirectAdminPayment, PaymentError } from "@/lib/services/payment.service";
import { emitToBusinessRoom } from "@/lib/socket-server";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  let billId: string | undefined;

  try {
    const params = await context.params;
    billId = params.id;
    const session = await getServerSession(authOptions);

    if (
      !session?.user?.businessId ||
      (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN")
    ) {
      return NextResponse.json(
        { error: "Bu işlem için admin yetkisi gereklidir.", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const body = await request.json();

    const rawMethod = body.method || body.paymentMethod;
    let method: "CASH" | "CARD" | "ONLINE" | "OTHER";
    switch (rawMethod) {
      case "CREDIT_CARD": method = "CARD"; break;
      case "CASH": method = "CASH"; break;
      case "CARD": method = "CARD"; break;
      case "ONLINE": method = "ONLINE"; break;
      case "OTHER": method = "OTHER"; break;
      default: method = "CARD"; break;
    }

    const amount = Number(body.amount);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Geçerli bir ödeme tutarı giriniz.", code: "INVALID_AMOUNT" },
        { status: 400 }
      );
    }

    const result = await createDirectAdminPayment({
      billId,
      amount,
      method,
      receivedAmount: body.receivedAmount != null ? Number(body.receivedAmount) : null,
      note: body.note || null,
      idempotencyKey: body.idempotencyKey || null,
      adminId: session.user.id,
      adminName: session.user.name || "Admin",
      businessId: session.user.businessId,
    });

    if (result.isFullyPaid && result.table) {
      try {
        emitToBusinessRoom(session.user.businessId, "table_status_update", {
          tableId: result.table.id,
          status: "EMPTY",
          message: `${result.table.tableName || "Masa " + result.table.tableNumber} hesabı ödendi ve masa boşaltıldı.`,
        });
        emitToBusinessRoom(session.user.businessId, "payment_collected", {
          tableNumber: result.table.tableNumber,
          tableName: result.table.tableName,
          amount,
          method,
          remainingAmount: Number(result.bill.remainingAmount),
          paymentStatus: result.bill.paymentStatus,
        });
      } catch (e) {
        console.error("Soket emit hatası:", e);
      }
    }

    return NextResponse.json({
      success: true,
      bill: result.bill,
      payment: result.payment,
      changeAmount: result.changeAmount,
      isFullyPaid: result.isFullyPaid,
      isIdempotent: result.isIdempotent,
    });
  } catch (error: any) {
    console.error("[ADMIN_PENDING_PAYMENT_PAY_FAILED]", {
      endpoint: "/api/admin/pending-payments/[id]/pay",
      code: error?.code,
      name: error?.name,
      message: error?.message,
      billId,
    });

    if (error instanceof PaymentError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }

    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Bu ödeme zaten işlenmiş.", code: "DUPLICATE_PAYMENT" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Ödeme işlenirken bir hata oluştu.", code: "PAYMENT_INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
