import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { processAdminPayment, PaymentError } from "@/lib/services/table-flow.service";
import { emitToBusinessRoom } from "@/lib/socket-server";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const session = await getServerSession(authOptions);

    // Yalnız ADMIN ve SUPER_ADMIN
    if (
      !session?.user?.businessId ||
      !session?.user?.id ||
      (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN")
    ) {
      return NextResponse.json(
        { success: false, error: "Bu işlem için admin yetkisi gereklidir." },
        { status: 403 }
      );
    }

    const businessId = session.user.businessId;
    const body = await request.json();

    // Bu route'ta [id] = paymentId — mevcut PENDING ödeme kaydını tamamlama
    const paymentId = params.id;

    // Mevcut ödeme kaydını bul
    const existingPayment = await prisma.payment.findFirst({
      where: { id: paymentId, businessId },
      include: { bill: true },
    });

    if (!existingPayment) {
      return NextResponse.json(
        { success: false, error: "Ödeme bulunamadı" },
        { status: 404 }
      );
    }

    // Ödeme zaten PAID ise idempotent döndür
    if (existingPayment.status === "PAID") {
      return NextResponse.json({
        success: true,
        payment: existingPayment,
        message: "Bu ödeme zaten tamamlanmış.",
      });
    }

    // billId'yi mevcut ödeme kaydından al
    const billId = existingPayment.billId;
    if (!billId) {
      return NextResponse.json(
        { success: false, error: "Bu ödeme kaydına bağlı adisyon bulunamadı." },
        { status: 400 }
      );
    }

    // Eski paymentMethod alanını method'a normalize et
    const rawMethod = body.method || body.paymentMethod;
    let method: "CASH" | "CARD" | "ONLINE" | "OTHER";
    switch (rawMethod) {
      case "CREDIT_CARD": method = "CARD"; break;
      case "CASH": method = "CASH"; break;
      case "CARD": method = "CARD"; break;
      case "ONLINE": method = "ONLINE"; break;
      case "OTHER": method = "OTHER"; break;
      default: method = existingPayment.method || "CARD"; break;
    }

    // Tutar: body'den alınır, yoksa mevcut ödeme kaydından
    const amount = body.amount ? Number(body.amount) : Number(existingPayment.amount);

    // Mevcut PENDING kaydını iptal et (processAdminPayment yeni kayıt oluşturacak)
    await prisma.payment.update({
      where: { id: paymentId },
      data: { status: "CANCELLED" },
    });

    const result = await processAdminPayment({
      billId,
      amount,
      method,
      receivedAmount: body.receivedAmount != null ? Number(body.receivedAmount) : null,
      note: body.note || existingPayment.note || null,
      idempotencyKey: body.idempotencyKey || null,
      adminId: session.user.id,
      adminName: session.user.name || "Admin",
      businessId,
    });

    // Socket bildirimi — transaction sonrası
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
    console.error("Ödeme tamamlama hatası:", error);

    if (error instanceof PaymentError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { success: false, error: "Sunucu hatası" },
      { status: 500 }
    );
  }
}