import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { processAdminPayment, PaymentError } from "@/lib/services/payment.service";
import { emitToBusinessRoom } from "@/lib/socket-server";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  let paymentId: string | undefined;

  try {
    const params = await context.params;
    paymentId = params.id;
    const { error, response, session } = await requireAdmin();
    if (error) return response;

    const businessId = session.user.businessId;
    const body = await request.json();

    const existingPayment = await prisma.payment.findFirst({
      where: { id: paymentId, businessId },
    });

    if (!existingPayment) {
      return NextResponse.json(
        { success: false, error: "Ödeme bulunamadı" },
        { status: 404 }
      );
    }

    if (existingPayment.status === "PAID") {
      return NextResponse.json({
        success: true,
        payment: existingPayment,
        message: "Bu ödeme zaten tamamlanmış.",
      });
    }

    const rawMethod = body.method || body.paymentMethod;
    let method: "CASH" | "CARD" | "ONLINE" | "OTHER";
    switch (rawMethod) {
      case "CREDIT_CARD": method = "CARD"; break;
      case "CASH": method = "CASH"; break;
      case "CARD": method = "CARD"; break;
      case "ONLINE": method = "ONLINE"; break;
      case "OTHER": method = "OTHER"; break;
      default: method = (existingPayment.method as any) || "CARD"; break;
    }

    const amount = body.amount ? Number(body.amount) : Number(existingPayment.amount);

    const result = await processAdminPayment({
      paymentId: existingPayment.id,
      businessId,
      adminId: session.user.id,
      adminName: session.user.name || "Admin",
      amount,
      method,
      receivedAmount: body.receivedAmount != null ? Number(body.receivedAmount) : null,
      note: body.note || existingPayment.note || null,
      idempotencyKey: body.idempotencyKey || null,
    });

    if (result.isFullyPaid && result.table) {
      try {
        emitToBusinessRoom(businessId, "table_status_update", {
          tableId: result.table.id,
          status: "EMPTY",
          message: `${result.table.tableName || "Masa " + result.table.tableNumber} hesabı ödendi ve masa boşaltıldı.`,
        });
      } catch (e) {
        console.error("Soket emit hatası:", e);
      }
    }

    return NextResponse.json({
      success: true,
      payment: result.payment,
      bill: result.bill,
      changeAmount: result.changeAmount,
      isFullyPaid: result.isFullyPaid,
    });
  } catch (error: any) {
    console.error("[ADMIN_PAYMENT_COMPLETE_FAILED]", {
      endpoint: "/api/admin/payments/[id]/complete",
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
      { success: false, error: "Ödeme işlenirken bir hata oluştu.", code: "PAYMENT_INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}