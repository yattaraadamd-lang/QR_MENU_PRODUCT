import { NextRequest, NextResponse } from "next/server";
import { requireWaiter, getBusinessId } from "@/lib/auth-helpers";
import { requestWaiterApproval, PaymentError } from "@/lib/services/payment.service";
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

    const { error, response, session } = await requireWaiter();

    if (error || !session || !session.user?.id) {
      return (
        response ||
        NextResponse.json(
          { success: false, error: "Yetkisiz erişim" },
          { status: 401 }
        )
      );
    }

    const businessId = getBusinessId(session);
    const body = await request.json();
    const { method, amount, receivedAmount, note } = body;

    if (!method || amount == null) {
      return NextResponse.json(
        { success: false, error: "Ödeme yöntemi ve tutar zorunludur." },
        { status: 400 }
      );
    }

    const updatedPayment = await requestWaiterApproval({
      paymentId,
      businessId,
      waiterId: session.user.id,
      waiterName: session.user.name || "Garson",
      method,
      amount: Number(amount),
      receivedAmount: receivedAmount != null ? Number(receivedAmount) : null,
      note: note || null,
    });

    // Socket.IO bildirimi
    try {
      emitToBusinessRoom(businessId, "payment_approval_requested", {
        paymentId: updatedPayment.id,
        tableNumber: updatedPayment.table?.tableNumber,
        tableName: updatedPayment.table?.tableName,
        amount: Number(updatedPayment.amount),
        method: updatedPayment.method,
        receivedAmount: updatedPayment.receivedAmount ? Number(updatedPayment.receivedAmount) : null,
        changeAmount: updatedPayment.changeAmount ? Number(updatedPayment.changeAmount) : null,
        waiterName: session.user.name,
        requestedAt: updatedPayment.approvalRequestedAt,
      });

      emitToBusinessRoom(businessId, "payment_request", {
        paymentId: updatedPayment.id,
        tableNumber: updatedPayment.table?.tableNumber,
        tableName: updatedPayment.table?.tableName,
        amount: Number(updatedPayment.amount),
        method: updatedPayment.method,
      });
    } catch (e) {
      console.error("Socket bildirim hatası:", e);
    }

    return NextResponse.json({
      success: true,
      message: "Ödeme bilgisi admin onayına gönderildi.",
      payment: updatedPayment,
    });
  } catch (error: any) {
    console.error("[PAYMENT_REQUEST_APPROVAL_FAILED]", {
      endpoint: "/api/waiter/payments/[id]/request-approval",
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

    return NextResponse.json(
      { success: false, error: "Ödeme onay talebi iletilirken bir hata oluştu.", code: "PAYMENT_INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
