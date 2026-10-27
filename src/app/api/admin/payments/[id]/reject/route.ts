import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getBusinessId } from "@/lib/auth-helpers";
import { rejectPayment, PaymentError } from "@/lib/services/payment.service";
import { emitToBusinessRoom } from "@/lib/socket-server";
import { withApiHandler, ApiError, parseJson } from "@/lib/api/handler";
import { paymentRejectSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const POST = withApiHandler("POST /api/admin/payments/[id]/reject", handlePost);

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
    const { reason } = await parseJson(request, paymentRejectSchema);

    const payment = await rejectPayment({
      paymentId,
      businessId,
      adminId: session.user.id,
      reason: reason || null,
    });

    try {
      emitToBusinessRoom(businessId, "payment_rejected", {
        paymentId: payment.id,
        tableId: payment.tableId,
        reason: payment.rejectionReason,
      });
    } catch (e) {
      console.error("Socket emit hatası:", e);
    }

    return NextResponse.json({
      success: true,
      message: "Ödeme talebi reddedildi.",
      payment,
    });
  } catch (error: any) {
    if (error instanceof ApiError) throw error;
    console.error("[ADMIN_PAYMENT_REJECT_FAILED]", {
      endpoint: "/api/admin/payments/[id]/reject",
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
      { success: false, error: "Ödeme talebi reddedilirken hata oluştu.", code: "PAYMENT_INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
