import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getBusinessId } from "@/lib/auth-helpers";
import { cancelOrderAndSyncState, OrderCancellationError } from "@/lib/services/order-cancellation.service";
import { OrderCancelReasonCode } from "@prisma/client";

// PUT /api/admin/orders/[orderId]/cancel - Admin sipariş iptal
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const params = await context.params;

    // ✅ Auth: Admin kontrolü
    const { error, response, session } = await requireAdmin();
    if (error) return response!;

    const businessId = getBusinessId(session);

    // ✅ Request body
    const body = await request.json();
    const { cancelReason, reasonCode, outOfStockProductIds } = body;

    // ✅ reasonCode validasyonu
    const validReasonCodes = Object.values(OrderCancelReasonCode);
    if (reasonCode && !validReasonCodes.includes(reasonCode)) {
      return NextResponse.json(
        { error: "Geçersiz iptal nedeni kodu.", code: "INVALID_CANCEL_REASON" },
        { status: 400 }
      );
    }

    // ✅ Merkezi servise delege et
    try {
      const result = await cancelOrderAndSyncState({
        orderId: params.orderId,
        businessId,
        actorId: session!.user.id,
        actorRole: "ADMIN",
        targetStatus: "CANCELLED",
        reasonCode: reasonCode || null,
        reasonText: cancelReason || null,
        outOfStockProductIds: outOfStockProductIds || null,
      });

      return NextResponse.json({
        message: "Sipariş iptal edildi",
        order: result.order,
        tableStatus: result.tableStatus,
        stockUpdatedProductIds: result.stockUpdatedProductIds,
      });
    } catch (err) {
      if (err instanceof OrderCancellationError) {
        return NextResponse.json(
          { error: err.message, code: err.code },
          { status: err.statusCode }
        );
      }
      throw err;
    }
  } catch (error) {
    console.error("Sipariş iptal hatası:", error);
    return NextResponse.json(
      { error: "Sipariş iptal edilirken bir hata oluştu" },
      { status: 500 }
    );
  }
}
