import { NextRequest, NextResponse } from "next/server";
import { requireWaiterOrAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // ✅ Garson ve admin erişebilir (kullanıcı/işletme durumu DB'den doğrulanır)
    const { error, response, session } = await requireWaiterOrAdmin();
    if (error) return response;

    const { businessId } = session.user;

    const bills = await prisma.bill.findMany({
      where: {
        businessId,
        status: "OPEN",
        totalAmount: { gt: 0 },
        remainingAmount: { gt: 0 }
      },
      include: {
        table: true,
        tableSession: {
          include: {
            orders: {
              where: { status: { not: "CANCELLED" } }
            }
          }
        }
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ bills });
  } catch (error) {
    console.error("Bekleyen ödemeler getirme hatası:", error);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
