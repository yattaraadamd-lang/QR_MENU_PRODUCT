import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getBusinessId } from "@/lib/auth-helpers";
import { processAdminPayment, PaymentError } from "@/lib/services/payment.service";
import { emitToBusinessRoom } from "@/lib/socket-server";
import { withApiHandler, ApiError, parseJson } from "@/lib/api/handler";
import { errorFields } from "@/lib/error-fields";
import { staffPaymentSchema, toPaymentMethod } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const POST = withApiHandler("POST /api/admin/payments/[id]/approve", handlePost);

async function handlePost(
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
    const { amount, method: rawMethod, receivedAmount, note, idempotencyKey } = await parseJson(request, staffPaymentSchema);
    const method = toPaymentMethod(rawMethod);
    if (!method) {
      return NextResponse.json(
        { success: false, error: "Ödeme yöntemi zorunludur.", code: "PAYMENT_METHOD_REQUIRED" },
        { status: 400 }
      );
    }

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

    // Socket bildirimleri: zaten ödenmiş (idempotent) yolda adisyon ya da masa okunamamışsa
    // ona bağlı yayın atlanır
    try {
      const { table, bill } = result;
      if (table) {
        emitToBusinessRoom(businessId, "payment_approved", {
          paymentId: result.payment.id,
          tableId: table.id,
          tableNumber: table.tableNumber,
          amount: Number(result.payment.amount),
          isFullyPaid: result.isFullyPaid,
        });
      }

      if (table && bill) {
        emitToBusinessRoom(businessId, "payment_collected", {
          tableNumber: table.tableNumber,
          tableName: table.tableName,
          amount: Number(result.payment.amount),
          method: result.payment.method,
          remainingAmount: Number(bill.remainingAmount),
          paymentStatus: bill.paymentStatus,
        });
      }

      if (table && result.isFullyPaid) {
        emitToBusinessRoom(businessId, "table_status_update", {
          tableId: table.id,
          status: "EMPTY",
          message: `${table.tableName || "Masa " + table.tableNumber} hesabı ödendi ve masa boşaltıldı.`,
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
  } catch (error) {
    if (error instanceof ApiError) throw error;
    const { code, name, message } = errorFields(error);
    console.error("[ADMIN_PAYMENT_APPROVE_FAILED]", {
      endpoint: "/api/admin/payments/[id]/approve",
      code,
      name,
      message,
      paymentId,
    });

    if (error instanceof PaymentError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }

    if (code === "P2002") {
      return NextResponse.json(
        { success: false, error: "Bu ödeme zaten işlenmiş.", code: "DUPLICATE_PAYMENT" },
        { status: 409 }
      );
    }

    if (code === "P2025") {
      return NextResponse.json(
        { success: false, error: "Ödeme durumu değişti. Lütfen sayfayı yenileyin.", code: "PAYMENT_STATE_CHANGED" },
        { status: 409 }
      );
    }

    if (code === "P2028" || (typeof message === "string" && message.includes("Transaction not found"))) {
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
