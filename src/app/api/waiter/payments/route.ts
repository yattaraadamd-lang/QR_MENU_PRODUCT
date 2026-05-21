import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWaiter, getBusinessId } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
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

    const payments = await prisma.payment.findMany({
      where: { businessId, status: "PENDING" },
      include: {
        table: { select: { tableNumber: true, tableName: true } },
        order: { select: { id: true, totalPrice: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, payments });
  } catch (error) {
    console.error("Ödemeler getirme hatası:", error);
    return NextResponse.json({ success: false, error: "Sunucu hatası" }, { status: 500 });
  }
}
