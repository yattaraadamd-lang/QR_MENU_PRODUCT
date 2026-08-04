import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getBusinessId } from "@/lib/auth-helpers";
import { processAdminPayment, PaymentError } from "@/lib/services/payment.service";
import { emitToBusinessRoom } from "@/lib/socket-server";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  let paymentId: string | undefined;

  try {
    const params = await context.params;
    paymentId = params.id;

    const { error, response, session } = await requireAdmin();
    if (error || !session || !session.user?.id) {
      return (
        response ||
        NextResponse.json(
          { success: false, error: "Bu işlem için admin yetkisi gereklidir." },
          { status: 403 }
        )
      );
    }

    const businessId = getBusinessId(session);
    const body = await request.json();
    const { amount, method, receivedAmount, note, idempotencyKey } = body;

    const result = await processAdminPayment({
      paymentId,
      businessId,
      adminId: session.user.id,
      adminName: session.user.name || "Admin",
      amount: Number(amount),
      method,
      receivedAmount: receivedAmount != null ? Number(receivedAmount) : null,
      note: note || null,
      idempotencyKey: idempotencyKey || null,
    });

    // Socket bildirimleri
    try {
      emitToBusinessRoom(businessId, "payment_approved", {
        paymentId: result.payment.id,
        tableId: result.table.id,
        tableNumber: result.table.tableNumber,
        amount: Number(result.payment.amount),
        isFullyPaid: result.isFullyPaid,
      });

      emitToBusinessRoom(businessId, "payment_collected", {
        tableNumber: result.table.tableNumber,
        tableName: result.table.tableName,
        amount: Number(result.payment.amount),
        method: result.payment.method,
        remainingAmount: Number(result.bill.remainingAmount),
        paymentStatus: result.bill.paymentStatus,
      });

      if (result.isFullyPaid) {
        emitToBusinessRoom(businessId, "table_status_update", {
          tableId: result.table.id,
          status: "EMPTY",
          message: `${result.table.tableName || "Masa " + result.table.tableNumber} hesabı ödendi ve masa boşaltıldı.`,
        });
      }
    } catch (e) {
      console.error("Socket emit hatası:", e);
    }

    return NextResponse.json({
      success: true,
      message: "Ödeme başarıyla onaylandı ve tahsil edildi.",
      payment: result.payment,
      bill: result.bill,
      changeAmount: result.changeAmount,
      isFullyPaid: result.isFullyPaid,
      isIdempotent: result.isIdempotent,
    });
  } catch (error: any) {
    console.error("[ADMIN_PAYMENT_APPROVE_FAILED]", {
      endpoint: "/api/admin/payments/[id]/approve",
      code: error?.code,
      name: error?.name,
      message: error?.message,
      paymentId,
    });

    if (error instanceof PaymentError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }

    if (error?.code === "P2002") {
      return NextResponse.json(
        { success: false, error: "Bu ödeme zaten işlenmiş.", code: "DUPLICATE_PAYMENT" },
        { status: 409 }
      );
    }

    if (error?.code === "P2025") {
      return NextResponse.json(
        { success: false, error: "Ödeme durumu değişti. Lütfen sayfayı yenileyin.", code: "PAYMENT_STATE_CHANGED" },
        { status: 409 }
      );
    }

    if (error?.code === "P2028" || error?.message?.includes("Transaction not found")) {
      return NextResponse.json(
        { success: false, error: "İşlem zaman aşımına uğradı. Tekrar deneyin.", code: "PAYMENT_TRANSACTION_EXPIRED" },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Ödeme onaylanırken bir hata oluştu.", code: "PAYMENT_INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
