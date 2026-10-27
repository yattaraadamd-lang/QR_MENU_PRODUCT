import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getBusinessId } from "@/lib/auth-helpers";
import { cancelOrderAndSyncState, OrderCancellationError } from "@/lib/services/order-cancellation.service";
import { OrderCancelReasonCode } from "@prisma/client";
import { withApiHandler, parseJson } from "@/lib/api/handler";
import { adminOrderCancelSchema } from "@/lib/validation";

// PUT /api/admin/orders/[orderId]/cancel - Admin sipariş iptal
export const PUT = withApiHandler("PUT /api/admin/orders/[orderId]/cancel", handlePut);

async function handlePut(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  const params = await context.params;

  // ✅ Auth: Admin kontrolü
  const { error, response, session } = await requireAdmin();
  if (error) return response!;

  const businessId = getBusinessId(session);

  // ✅ Request body
  const { cancelReason, reasonCode, outOfStockProductIds } = await parseJson(request, adminOrderCancelSchema);

  // ✅ reasonCode validasyonu
  const validReasonCodes = Object.values(OrderCancelReasonCode);
  if (reasonCode && !(validReasonCodes as string[]).includes(reasonCode)) {
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
      reasonCode: (reasonCode as OrderCancelReasonCode | null | undefined) || null, // yukarıda enum'a karşı denetlendi
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
}
