import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWaiter, getBusinessId } from "@/lib/auth-helpers";
import { PaymentMethod, PaymentStatus, TableStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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
    const { method, note } = body;

    const payment = await prisma.payment.findFirst({
      where: { id: params.id, businessId },
    });

    if (!payment) {
      return NextResponse.json({ error: "Ödeme bulunamadı" }, { status: 404 });
    }

    const updatedPayment = await prisma.payment.update({
      where: { id: params.id },
      data: {
        status: PaymentStatus.PAID,
        method: method as PaymentMethod,
        note: note || null,
        paidAt: new Date(),
        handledById: session.user.id,
        handledByWaiterName: session.user.name || null, // ✅ Garson adı kaydediliyor
      },
    });

    // Masayı EMPTY yap
    await prisma.table.update({
      where: { id: payment.tableId },
      data: { status: TableStatus.EMPTY },
    });

    return NextResponse.json({ success: true, payment: updatedPayment });
  } catch (error) {
    console.error("Ödeme tamamlama hatası:", error);
    return NextResponse.json({ success: false, error: "Sunucu hatası" }, { status: 500 });
  }
}
