import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, getBusinessId } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { error, response, session } = await requireAdmin();
    if (error) return response!;

    const businessId = getBusinessId(session);

    const payments = await prisma.payment.findMany({
      where: { businessId },
      include: {
        table: { select: { id: true, tableNumber: true, tableName: true } },
        order: { select: { id: true, totalPrice: true } },
        bill: { select: { id: true, totalAmount: true, paidAmount: true, remainingAmount: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, payments });
  } catch (error) {
    console.error("Ödemeler getirme hatası:", error);
    return NextResponse.json({ success: false, error: "Sunucu hatası" }, { status: 500 });
  }
}
